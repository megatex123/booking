from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timedelta, date
from bson import ObjectId
from typing import Optional
from math import ceil
from collections import defaultdict
from core.database import get_db
from middleware.auth import get_current_user, require_workshop
from models.workshop import (
    WorkshopUpdate, WorkshopServiceCreate, WorkshopServiceUpdate,
    ProductCreate, ProductUpdate, RepairStationCreate, RepairStationUpdate,
    MechanicCreate, MechanicUpdate, WorkshopPanelUpdate,
    PromotionCreate, PromotionUpdate,
)


def normalize_image(img) -> dict:
    """Coerce legacy string URLs and new WorkshopImage dicts to a uniform dict."""
    if isinstance(img, str):
        return {"url": img, "category": "other", "caption": ""}
    if hasattr(img, "url"):  # Pydantic model
        return {"url": img.url, "category": img.category or "other", "caption": img.caption or ""}
    return {"url": img.get("url", ""), "category": img.get("category", "other"), "caption": img.get("caption", "")}

router = APIRouter(prefix="/workshops", tags=["workshops"])


async def compute_queue_snapshot(workshop_id: str, db) -> dict:
    """
    Compute live queue metrics from active stations and in_progress bookings.
    Saved back to workshops.queue_snapshot for fast list rendering.
    """
    workshop = await db.workshops.find_one({"_id": workshop_id})
    if not workshop:
        return {}

    total_stations = len([s for s in workshop.get("stations", []) if s.get("is_active", True)])
    active_bookings = await db.bookings.find(
        {"workshop_id": workshop_id, "status": "in_progress"}
    ).to_list(None)
    active_jobs = len(active_bookings)

    # Average duration of a job (from their service lists)
    all_durations = [
        svc.get("duration_minutes", 60)
        for b in active_bookings
        for svc in b.get("services", [])
    ]
    avg_duration = int(sum(all_durations) / len(all_durations)) if all_durations else 60

    if total_stations == 0:
        est_wait_minutes = None
        available_stations = 0
    else:
        available_stations = max(0, total_stations - active_jobs)
        if available_stations > 0:
            est_wait_minutes = 0
        else:
            # Every bay is occupied; estimate one full job-cycle per overflow layer
            overflow_layers = ceil(active_jobs / total_stations)
            est_wait_minutes = overflow_layers * avg_duration

    snapshot = {
        "total_stations": total_stations,
        "active_jobs": active_jobs,
        "available_stations": available_stations,
        "est_wait_minutes": est_wait_minutes,
        "avg_job_duration": avg_duration,
        "updated_at": datetime.utcnow().isoformat(),
    }
    await db.workshops.update_one(
        {"_id": workshop_id}, {"$set": {"queue_snapshot": snapshot}}
    )
    return snapshot


def serialize_workshop(w: dict, distance_km: float = None) -> dict:
    now = datetime.utcnow()
    active_promos = []
    for p in w.get("promotions", []):
        if not p.get("is_active", True):
            continue
        ends = p.get("ends_at")
        if isinstance(ends, datetime) and ends > now:
            active_promos.append({
                "id": p["_id"],
                "title": p["title"],
                "description": p.get("description", ""),
                "ends_at": ends.isoformat(),
            })
    d = {
        "id": w["_id"],
        "owner_id": w["owner_id"],
        "workshop_name": w["workshop_name"],
        "description": w.get("description", ""),
        "address": w["address"],
        "phone": w["phone"],
        "latitude": w["latitude"],
        "longitude": w["longitude"],
        "rating": w.get("rating", 0.0),
        "total_reviews": w.get("total_reviews", 0),
        "is_open": w.get("is_open", True),
        "open_hour": w.get("open_hour", "08:00"),
        "close_hour": w.get("close_hour", "18:00"),
        "working_hours": w.get("working_hours", {}),
        "images": [normalize_image(img) for img in w.get("images", [])],
        "services": w.get("services", []),
        "is_panel_workshop": w.get("is_panel_workshop", False),
        "panel_providers": w.get("panel_providers", []),
        "queue_snapshot": w.get("queue_snapshot"),
        "active_promotions": active_promos,
        "created_at": w["created_at"],
    }
    if distance_km is not None:
        d["distance_km"] = round(distance_km, 2)
    return d


@router.get("/nearby")
async def get_nearby_workshops(
    latitude: float = Query(...),
    longitude: float = Query(...),
    radius_km: float = Query(100.0),
    category: Optional[str] = Query(None),
    panel_provider: Optional[str] = Query(None),
    db=Depends(get_db),
):
    radius_meters = radius_km * 1000
    query = {
        "location": {
            "$near": {
                "$geometry": {"type": "Point", "coordinates": [longitude, latitude]},
                "$maxDistance": radius_meters,
            }
        }
    }
    if panel_provider:
        query["panel_providers"] = panel_provider
        query["is_panel_workshop"] = True
    workshops = await db.workshops.find(query).to_list(50)

    if category:
        workshops = [
            w for w in workshops
            if any(s.get("category") == category for s in w.get("services", []))
        ]

    result = []
    for w in workshops:
        lon2, lat2 = w["location"]["coordinates"]
        dist = _haversine(latitude, longitude, lat2, lon2)
        result.append(serialize_workshop(w, dist))

    return result


@router.get("/{workshop_id}/queue")
async def get_workshop_queue(workshop_id: str, db=Depends(get_db)):
    """Live queue snapshot — forces a fresh recompute."""
    w = await db.workshops.find_one({"_id": workshop_id})
    if not w:
        raise HTTPException(status_code=404, detail="Workshop not found")
    return await compute_queue_snapshot(workshop_id, db)


@router.get("/{workshop_id}")
async def get_workshop(workshop_id: str, db=Depends(get_db)):
    w = await db.workshops.find_one({"_id": workshop_id})
    if not w:
        raise HTTPException(status_code=404, detail="Workshop not found")
    return serialize_workshop(w)


@router.get("/my/profile")
async def get_my_workshop(user=Depends(require_workshop), db=Depends(get_db)):
    w = await db.workshops.find_one({"owner_id": user["_id"]})
    if not w:
        raise HTTPException(status_code=404, detail="Workshop not found")
    return serialize_workshop(w)


@router.patch("/my/profile")
async def update_my_workshop(data: WorkshopUpdate, user=Depends(require_workshop), db=Depends(get_db)):
    update = {"updated_at": datetime.utcnow()}
    for field, val in data.dict(exclude_none=True).items():
        update[field] = val

    # Normalize images to {url, category, caption} dicts
    if "images" in update:
        update["images"] = [normalize_image(img) for img in update["images"]]

    # Keep GeoJSON location in sync for geospatial queries
    if "latitude" in update or "longitude" in update:
        w_cur = await db.workshops.find_one({"owner_id": user["_id"]}) or {}
        lat = update.get("latitude", w_cur.get("latitude", 0))
        lng = update.get("longitude", w_cur.get("longitude", 0))
        update["location"] = {"type": "Point", "coordinates": [lng, lat]}

    await db.workshops.update_one({"owner_id": user["_id"]}, {"$set": update})
    w = await db.workshops.find_one({"owner_id": user["_id"]})
    return serialize_workshop(w)


@router.post("/my/services")
async def add_service(data: WorkshopServiceCreate, user=Depends(require_workshop), db=Depends(get_db)):
    service = {
        "_id": str(ObjectId()),
        **data.dict(),
        "is_active": True,
        "created_at": datetime.utcnow().isoformat(),
    }
    await db.workshops.update_one(
        {"owner_id": user["_id"]},
        {"$push": {"services": service}},
    )
    return service


@router.patch("/my/services/{service_id}")
async def update_service(
    service_id: str,
    data: WorkshopServiceUpdate,
    user=Depends(require_workshop),
    db=Depends(get_db),
):
    w = await db.workshops.find_one({"owner_id": user["_id"]})
    if not w:
        raise HTTPException(status_code=404, detail="Workshop not found")

    services = w.get("services", [])
    updated = False
    for s in services:
        if s["_id"] == service_id:
            for k, v in data.dict(exclude_none=True).items():
                s[k] = v
            updated = True
            break

    if not updated:
        raise HTTPException(status_code=404, detail="Service not found")

    await db.workshops.update_one({"owner_id": user["_id"]}, {"$set": {"services": services}})
    return {"message": "Service updated"}


@router.delete("/my/services/{service_id}")
async def delete_service(service_id: str, user=Depends(require_workshop), db=Depends(get_db)):
    await db.workshops.update_one(
        {"owner_id": user["_id"]},
        {"$pull": {"services": {"_id": service_id}}},
    )
    return {"message": "Service deleted"}


# ── Products (inventory) ────────────────────────────────────────────────────

@router.get("/my/products")
async def get_products(user=Depends(require_workshop), db=Depends(get_db)):
    w = await db.workshops.find_one({"owner_id": user["_id"]})
    if not w:
        raise HTTPException(status_code=404, detail="Workshop not found")
    return w.get("products", [])


@router.post("/my/products", status_code=201)
async def add_product(data: ProductCreate, user=Depends(require_workshop), db=Depends(get_db)):
    product = {"_id": str(ObjectId()), **data.dict(), "created_at": datetime.utcnow().isoformat()}
    await db.workshops.update_one({"owner_id": user["_id"]}, {"$push": {"products": product}})
    return product


@router.patch("/my/products/{product_id}")
async def update_product(product_id: str, data: ProductUpdate, user=Depends(require_workshop), db=Depends(get_db)):
    w = await db.workshops.find_one({"owner_id": user["_id"]})
    if not w:
        raise HTTPException(status_code=404, detail="Workshop not found")
    products = w.get("products", [])
    for p in products:
        if p["_id"] == product_id:
            for k, v in data.dict(exclude_none=True).items():
                p[k] = v
            await db.workshops.update_one({"owner_id": user["_id"]}, {"$set": {"products": products}})
            return p
    raise HTTPException(status_code=404, detail="Product not found")


@router.delete("/my/products/{product_id}", status_code=204)
async def delete_product(product_id: str, user=Depends(require_workshop), db=Depends(get_db)):
    await db.workshops.update_one(
        {"owner_id": user["_id"]},
        {"$pull": {"products": {"_id": product_id}}},
    )


# ── Repair Stations ──────────────────────────────────────────────────────────

@router.get("/my/stations")
async def get_stations(user=Depends(require_workshop), db=Depends(get_db)):
    w = await db.workshops.find_one({"owner_id": user["_id"]})
    if not w:
        raise HTTPException(status_code=404, detail="Workshop not found")
    return w.get("repair_stations", [])


@router.post("/my/stations", status_code=201)
async def add_station(data: RepairStationCreate, user=Depends(require_workshop), db=Depends(get_db)):
    station = {"_id": str(ObjectId()), **data.dict(), "is_active": True, "created_at": datetime.utcnow().isoformat()}
    await db.workshops.update_one({"owner_id": user["_id"]}, {"$push": {"repair_stations": station}})
    return station


@router.patch("/my/stations/{station_id}")
async def update_station(station_id: str, data: RepairStationUpdate, user=Depends(require_workshop), db=Depends(get_db)):
    w = await db.workshops.find_one({"owner_id": user["_id"]})
    if not w:
        raise HTTPException(status_code=404, detail="Workshop not found")
    stations = w.get("repair_stations", [])
    for s in stations:
        if s["_id"] == station_id:
            for k, v in data.dict(exclude_none=True).items():
                s[k] = v
            await db.workshops.update_one({"owner_id": user["_id"]}, {"$set": {"repair_stations": stations}})
            return s
    raise HTTPException(status_code=404, detail="Station not found")


@router.delete("/my/stations/{station_id}", status_code=204)
async def delete_station(station_id: str, user=Depends(require_workshop), db=Depends(get_db)):
    await db.workshops.update_one(
        {"owner_id": user["_id"]},
        {"$pull": {"repair_stations": {"_id": station_id}}},
    )


# ── Mechanics ────────────────────────────────────────────────────────────────

@router.get("/my/mechanics")
async def get_mechanics(user=Depends(require_workshop), db=Depends(get_db)):
    w = await db.workshops.find_one({"owner_id": user["_id"]})
    if not w:
        raise HTTPException(status_code=404, detail="Workshop not found")
    return w.get("mechanics", [])


@router.post("/my/mechanics", status_code=201)
async def add_mechanic(data: MechanicCreate, user=Depends(require_workshop), db=Depends(get_db)):
    mechanic = {"_id": str(ObjectId()), **data.dict(), "created_at": datetime.utcnow().isoformat()}
    await db.workshops.update_one({"owner_id": user["_id"]}, {"$push": {"mechanics": mechanic}})
    return mechanic


@router.patch("/my/mechanics/{mechanic_id}")
async def update_mechanic(mechanic_id: str, data: MechanicUpdate, user=Depends(require_workshop), db=Depends(get_db)):
    w = await db.workshops.find_one({"owner_id": user["_id"]})
    if not w:
        raise HTTPException(status_code=404, detail="Workshop not found")
    mechanics = w.get("mechanics", [])
    for m in mechanics:
        if m["_id"] == mechanic_id:
            for k, v in data.dict(exclude_none=True).items():
                m[k] = v
            await db.workshops.update_one({"owner_id": user["_id"]}, {"$set": {"mechanics": mechanics}})
            return m
    raise HTTPException(status_code=404, detail="Mechanic not found")


@router.delete("/my/mechanics/{mechanic_id}", status_code=204)
async def delete_mechanic(mechanic_id: str, user=Depends(require_workshop), db=Depends(get_db)):
    await db.workshops.update_one(
        {"owner_id": user["_id"]},
        {"$pull": {"mechanics": {"_id": mechanic_id}}},
    )


# ── Analytics ─────────────────────────────────────────────────────────────────

@router.get("/my/analytics")
async def get_analytics(months: int = Query(6, ge=1, le=24), user=Depends(require_workshop), db=Depends(get_db)):
    w = await db.workshops.find_one({"owner_id": user["_id"]})
    if not w:
        raise HTTPException(status_code=404, detail="Workshop not found")
    workshop_id = w["_id"]

    cutoff = datetime.utcnow() - timedelta(days=months * 30)
    bookings = await db.bookings.find(
        {"workshop_id": workshop_id, "created_at": {"$gte": cutoff}}
    ).to_list(None)

    # Build all N month keys (YYYY-MM), ascending — oldest first
    now = datetime.utcnow()
    month_keys = []
    for i in range(months - 1, -1, -1):
        # i months ago: subtract i months from (now.year, now.month)
        total = now.year * 12 + (now.month - 1) - i
        target_year = total // 12
        target_month = (total % 12) + 1
        month_keys.append(f"{target_year:04d}-{target_month:02d}")

    # Monthly revenue aggregation
    monthly_data = defaultdict(lambda: {"revenue": 0.0, "count": 0})
    peak_hours = {str(h): 0 for h in range(24)}
    service_revenue = defaultdict(lambda: {"revenue": 0.0, "count": 0})

    # Customer stats
    customer_completed = defaultdict(int)

    for b in bookings:
        status = b.get("status", "")
        created_at = b.get("created_at")
        if isinstance(created_at, datetime):
            mk = created_at.strftime("%Y-%m")
        elif isinstance(created_at, str):
            mk = created_at[:7]
        else:
            mk = None

        if status == "completed":
            revenue = b.get("total_price", 0.0)
            if mk:
                monthly_data[mk]["revenue"] += revenue
                monthly_data[mk]["count"] += 1

            # Top services
            for svc in b.get("services", []):
                sname = svc.get("name", "Unknown")
                sprice = svc.get("price", 0.0)
                service_revenue[sname]["revenue"] += sprice
                service_revenue[sname]["count"] += 1

            # Customer repeat tracking
            customer_completed[b.get("customer_id")] += 1

        # Peak hours — all non-cancelled
        if status != "cancelled":
            sched_time = b.get("scheduled_time", "")
            if sched_time and ":" in sched_time:
                try:
                    hour = int(sched_time.split(":")[0])
                    if 0 <= hour <= 23:
                        peak_hours[str(hour)] += 1
                except ValueError:
                    pass

    # Build monthly_revenue list (fill zeros for missing months)
    monthly_revenue = []
    for mk in month_keys:
        d = monthly_data.get(mk, {"revenue": 0.0, "count": 0})
        monthly_revenue.append({"month": mk, "revenue": d["revenue"], "count": d["count"]})

    # Top 8 services by revenue
    top_services = sorted(
        [{"name": k, "revenue": v["revenue"], "count": v["count"]} for k, v in service_revenue.items()],
        key=lambda x: x["revenue"],
        reverse=True,
    )[:8]

    # Customer stats
    total_customers = len(customer_completed)
    repeat_customers = sum(1 for cnt in customer_completed.values() if cnt > 1)
    new_customers = total_customers - repeat_customers
    repeat_rate = round(repeat_customers / total_customers, 4) if total_customers > 0 else 0.0

    return {
        "monthly_revenue": monthly_revenue,
        "peak_hours": peak_hours,
        "top_services": top_services,
        "customer_stats": {
            "total": total_customers,
            "repeat": repeat_customers,
            "new": new_customers,
            "repeat_rate": repeat_rate,
        },
    }


# ── CRM ───────────────────────────────────────────────────────────────────────

@router.get("/my/customers")
async def get_customers_crm(user=Depends(require_workshop), db=Depends(get_db)):
    w = await db.workshops.find_one({"owner_id": user["_id"]})
    if not w:
        raise HTTPException(status_code=404, detail="Workshop not found")
    workshop_id = w["_id"]

    bookings = await db.bookings.find(
        {"workshop_id": workshop_id, "status": "completed"}
    ).to_list(None)

    customers = {}
    for b in bookings:
        cid = b.get("customer_id")
        if not cid:
            continue
        scheduled_date = b.get("scheduled_date", "")
        vehicle = b.get("vehicle_name") or b.get("vehicle_plate") or ""

        if cid not in customers:
            customers[cid] = {
                "customer_id": cid,
                "name": b.get("customer_name", ""),
                "phone": b.get("customer_phone", ""),
                "total_visits": 0,
                "total_spent": 0.0,
                "last_visit": scheduled_date,
                "vehicles": [],
            }

        customers[cid]["total_visits"] += 1
        customers[cid]["total_spent"] += b.get("total_price", 0.0)

        # Keep the latest scheduled_date
        if scheduled_date > customers[cid]["last_visit"]:
            customers[cid]["last_visit"] = scheduled_date

        # Collect unique vehicles
        if vehicle and vehicle not in customers[cid]["vehicles"]:
            customers[cid]["vehicles"].append(vehicle)

    result = sorted(customers.values(), key=lambda x: x["last_visit"], reverse=True)
    return result


# ── Panel Workshop Settings ────────────────────────────────────────────────

@router.patch("/my/panel")
async def update_panel_settings(data: WorkshopPanelUpdate, user=Depends(require_workshop), db=Depends(get_db)):
    w = await db.workshops.find_one({"owner_id": user["_id"]})
    if not w:
        raise HTTPException(status_code=404, detail="Workshop not found")
    await db.workshops.update_one(
        {"_id": w["_id"]},
        {"$set": {
            "is_panel_workshop": data.is_panel_workshop,
            "panel_providers": data.panel_providers or [],
            "updated_at": datetime.utcnow(),
        }},
    )
    updated = await db.workshops.find_one({"_id": w["_id"]})
    return {
        "is_panel_workshop": updated.get("is_panel_workshop", False),
        "panel_providers": updated.get("panel_providers", []),
    }


# ── Promotions / Flash Deals ───────────────────────────────────────────────

@router.get("/my/promotions")
async def list_promotions(user=Depends(require_workshop), db=Depends(get_db)):
    w = await db.workshops.find_one({"owner_id": user["_id"]})
    if not w:
        raise HTTPException(status_code=404, detail="Workshop not found")
    now = datetime.utcnow()
    result = []
    for p in w.get("promotions", []):
        ends = p.get("ends_at")
        result.append({
            "id": p["_id"],
            "title": p["title"],
            "description": p.get("description", ""),
            "ends_at": ends.isoformat() if isinstance(ends, datetime) else ends,
            "is_active": p.get("is_active", True),
            "is_expired": isinstance(ends, datetime) and ends <= now,
            "created_at": p["created_at"].isoformat() if isinstance(p.get("created_at"), datetime) else "",
        })
    return sorted(result, key=lambda x: x["created_at"], reverse=True)


@router.post("/my/promotions", status_code=201)
async def create_promotion(data: PromotionCreate, user=Depends(require_workshop), db=Depends(get_db)):
    w = await db.workshops.find_one({"owner_id": user["_id"]})
    if not w:
        raise HTTPException(status_code=404, detail="Workshop not found")
    try:
        ends_at = datetime.fromisoformat(data.ends_at.replace("Z", ""))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ends_at — use ISO 8601 format")
    if ends_at <= datetime.utcnow():
        raise HTTPException(status_code=400, detail="ends_at must be in the future")
    promo = {
        "_id": str(ObjectId()),
        "title": data.title.strip(),
        "description": data.description or "",
        "ends_at": ends_at,
        "is_active": True,
        "created_at": datetime.utcnow(),
    }
    await db.workshops.update_one({"_id": w["_id"]}, {"$push": {"promotions": promo}})
    return {"id": promo["_id"], "title": promo["title"], "ends_at": ends_at.isoformat()}


@router.patch("/my/promotions/{promo_id}")
async def update_promotion(promo_id: str, data: PromotionUpdate, user=Depends(require_workshop), db=Depends(get_db)):
    w = await db.workshops.find_one({"owner_id": user["_id"]})
    if not w:
        raise HTTPException(status_code=404, detail="Workshop not found")
    promo = next((p for p in w.get("promotions", []) if p["_id"] == promo_id), None)
    if not promo:
        raise HTTPException(status_code=404, detail="Promotion not found")
    fields: dict = {}
    if data.title is not None:
        fields["promotions.$.title"] = data.title.strip()
    if data.description is not None:
        fields["promotions.$.description"] = data.description
    if data.ends_at is not None:
        try:
            ends_at = datetime.fromisoformat(data.ends_at.replace("Z", ""))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid ends_at format")
        fields["promotions.$.ends_at"] = ends_at
    if data.is_active is not None:
        fields["promotions.$.is_active"] = data.is_active
    if fields:
        await db.workshops.update_one(
            {"_id": w["_id"], "promotions._id": promo_id},
            {"$set": fields},
        )
    return {"ok": True}


@router.delete("/my/promotions/{promo_id}", status_code=204)
async def delete_promotion(promo_id: str, user=Depends(require_workshop), db=Depends(get_db)):
    w = await db.workshops.find_one({"owner_id": user["_id"]})
    if not w:
        raise HTTPException(status_code=404, detail="Workshop not found")
    await db.workshops.update_one(
        {"_id": w["_id"]},
        {"$pull": {"promotions": {"_id": promo_id}}},
    )


def _haversine(lat1, lon1, lat2, lon2) -> float:
    from math import radians, sin, cos, sqrt, atan2
    R = 6371
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))
