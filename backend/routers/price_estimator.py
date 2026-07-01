from fastapi import APIRouter, Query, Depends
from typing import List, Optional
from pydantic import BaseModel
from core.database import get_db
from middleware.auth import get_current_user
import math

router = APIRouter(prefix="/price-estimator", tags=["price-estimator"])

# Symptom → service category + keyword filters
SYMPTOM_CATALOG = [
    {"id": "squeaky_brakes",   "label": "Squeaky / grinding brakes",      "icon": "car-sport",          "category": "brake",      "keywords": ["brake", "pad", "disc", "caliper", "drum"]},
    {"id": "brake_soft",       "label": "Brake pedal feels soft",         "icon": "warning",            "category": "brake",      "keywords": ["brake", "fluid", "bleed"]},
    {"id": "ac_not_cold",      "label": "AC not cold",                    "icon": "snow",               "category": "electrical", "keywords": ["air-con", "a/c", "aircon", "regas", "refrigerant", "compressor", "evaporator"]},
    {"id": "ac_smell",         "label": "AC smells bad",                  "icon": "warning-outline",    "category": "electrical", "keywords": ["air-con", "a/c", "aircon", "cabin filter", "evaporator"]},
    {"id": "engine_light",     "label": "Engine warning light on",        "icon": "alert-circle",       "category": "engine",     "keywords": ["engine", "diagnostic", "ecu", "tune", "check"]},
    {"id": "rough_idle",       "label": "Rough idle / engine shaking",    "icon": "pulse",              "category": "engine",     "keywords": ["engine", "spark plug", "fuel", "idle", "tune"]},
    {"id": "wont_start",       "label": "Car won't start",                "icon": "battery-dead",       "category": "electrical", "keywords": ["battery", "starter", "alternator", "electrical"]},
    {"id": "oil_leak",         "label": "Oil leak / oil warning light",   "icon": "water",              "category": "oil_change", "keywords": ["oil", "lubricant", "seal", "gasket"]},
    {"id": "overheating",      "label": "Engine overheating",             "icon": "thermometer",        "category": "engine",     "keywords": ["coolant", "radiator", "thermostat", "engine", "water pump"]},
    {"id": "tyre_flat",        "label": "Flat tyre / puncture",           "icon": "ellipse-outline",    "category": "tire",       "keywords": ["tyre", "tire", "puncture", "patch"]},
    {"id": "tyre_vibration",   "label": "Vibration / uneven tyre wear",   "icon": "reload",             "category": "tire",       "keywords": ["tyre", "tire", "alignment", "balancing", "wheel", "rotation"]},
    {"id": "suspension_noise", "label": "Clunking noise over bumps",      "icon": "volume-high",        "category": "other",      "keywords": ["suspension", "shock", "strut", "absorber", "bushing", "link"]},
    {"id": "gear_slip",        "label": "Gear slipping / hard to shift",  "icon": "options",            "category": "engine",     "keywords": ["transmission", "gearbox", "clutch", "gear", "atf"]},
    {"id": "body_damage",      "label": "Scratch / dent repair",          "icon": "construct",          "category": "body",       "keywords": ["body", "paint", "dent", "scratch", "panel", "bumper", "respray"]},
    {"id": "windscreen",       "label": "Cracked / foggy windscreen",     "icon": "scan",               "category": "body",       "keywords": ["windscreen", "wiper", "glass", "tint"]},
    {"id": "electrical_fault", "label": "Electrical fault / lights out",  "icon": "flash",              "category": "electrical", "keywords": ["electrical", "wiring", "fuse", "light", "battery", "alternator"]},
    {"id": "oil_change_due",   "label": "Routine oil change",             "icon": "refresh",            "category": "oil_change", "keywords": ["oil change", "oil service", "oil filter", "lubricant"]},
]

SYMPTOM_BY_ID = {s["id"]: s for s in SYMPTOM_CATALOG}


def _haversine(lat1, lon1, lat2, lon2) -> float:
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def _service_matches(service: dict, symptom: dict) -> bool:
    """True if a workshop service matches a symptom by category or keywords."""
    if service.get("category") == symptom["category"]:
        return True
    name_lower = service.get("name", "").lower()
    desc_lower = service.get("description", "").lower()
    text = name_lower + " " + desc_lower
    return any(kw.lower() in text for kw in symptom["keywords"])


class EstimateRequest(BaseModel):
    symptom_ids: List[str]
    latitude: float
    longitude: float
    radius_km: float = 30.0


@router.get("/symptoms")
async def list_symptoms():
    return SYMPTOM_CATALOG


@router.post("/estimate")
async def estimate_prices(body: EstimateRequest, db=Depends(get_db)):
    # Fetch nearby workshops
    radius_meters = body.radius_km * 1000
    workshops = await db.workshops.find({
        "location": {
            "$near": {
                "$geometry": {"type": "Point", "coordinates": [body.longitude, body.latitude]},
                "$maxDistance": radius_meters,
            }
        }
    }).to_list(100)

    workshops_scanned = len(workshops)

    results = []
    for symptom_id in body.symptom_ids:
        symptom = SYMPTOM_BY_ID.get(symptom_id)
        if not symptom:
            continue

        prices: List[float] = []
        sample_services = []

        for w in workshops:
            for svc in w.get("services", []):
                if not svc.get("is_active", True):
                    continue
                if _service_matches(svc, symptom):
                    prices.append(svc["price"])
                    if len(sample_services) < 5:
                        sample_services.append({
                            "workshop_id": w["_id"],
                            "workshop_name": w["workshop_name"],
                            "distance_km": round(_haversine(body.latitude, body.longitude, *reversed(w["location"]["coordinates"])), 1),
                            "service_name": svc["name"],
                            "price": svc["price"],
                            "duration_minutes": svc.get("duration_minutes", 60),
                        })

        if prices:
            results.append({
                "symptom_id": symptom_id,
                "symptom_label": symptom["label"],
                "symptom_icon": symptom["icon"],
                "category": symptom["category"],
                "min_price": round(min(prices), 2),
                "max_price": round(max(prices), 2),
                "avg_price": round(sum(prices) / len(prices), 2),
                "workshop_count": len(set(s["workshop_id"] for s in sample_services)),
                "sample_services": sorted(sample_services, key=lambda x: x["price"]),
            })
        else:
            results.append({
                "symptom_id": symptom_id,
                "symptom_label": symptom["label"],
                "symptom_icon": symptom["icon"],
                "category": symptom["category"],
                "min_price": None,
                "max_price": None,
                "avg_price": None,
                "workshop_count": 0,
                "sample_services": [],
            })

    return {
        "estimates": results,
        "workshops_scanned": workshops_scanned,
        "radius_km": body.radius_km,
    }
