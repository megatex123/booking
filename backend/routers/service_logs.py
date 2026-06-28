from datetime import datetime
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from core.database import get_db
from middleware.auth import require_customer

router = APIRouter(prefix="/service-logs", tags=["service-logs"])


class ServiceLogCreate(BaseModel):
    vehicle_plate: str
    service_date: str          # "YYYY-MM-DD"
    location: str              # workshop name, "DIY", "Home Garage", etc.
    services: List[str]        # list of service names
    notes: Optional[str] = None
    mileage: Optional[int] = None
    cost: Optional[float] = None
    next_service_months: Optional[int] = None   # for health score


class ServiceLogUpdate(BaseModel):
    service_date: Optional[str] = None
    location: Optional[str] = None
    services: Optional[List[str]] = None
    notes: Optional[str] = None
    mileage: Optional[int] = None
    cost: Optional[float] = None
    next_service_months: Optional[int] = None


def _serialize(doc: dict) -> dict:
    def _iso(v):
        return v.isoformat() if isinstance(v, datetime) else v

    return {
        "id": doc["_id"],
        "vehicle_plate": doc["vehicle_plate"],
        "service_date": doc["service_date"],
        "location": doc["location"],
        "services": doc.get("services", []),
        "notes": doc.get("notes"),
        "mileage": doc.get("mileage"),
        "cost": doc.get("cost"),
        "next_service_months": doc.get("next_service_months"),
        "source": "manual",
        "created_at": _iso(doc.get("created_at")),
        "updated_at": _iso(doc.get("updated_at")),
    }


@router.get("/")
async def list_logs(
    plate: Optional[str] = Query(None),
    current_user: dict = Depends(require_customer),
    db=Depends(get_db),
):
    query: dict = {"user_id": current_user["_id"]}
    if plate:
        query["vehicle_plate"] = plate.upper().strip()

    docs = await db.manual_service_logs.find(query).sort("service_date", -1).to_list(200)
    return [_serialize(d) for d in docs]


@router.post("/", status_code=201)
async def create_log(
    data: ServiceLogCreate,
    current_user: dict = Depends(require_customer),
    db=Depends(get_db),
):
    now = datetime.utcnow()
    doc = {
        "_id": str(ObjectId()),
        "user_id": current_user["_id"],
        "vehicle_plate": data.vehicle_plate.upper().strip(),
        "service_date": data.service_date,
        "location": data.location.strip(),
        "services": [s.strip() for s in data.services if s.strip()],
        "notes": data.notes,
        "mileage": data.mileage,
        "cost": data.cost,
        "next_service_months": data.next_service_months,
        "created_at": now,
        "updated_at": now,
    }
    await db.manual_service_logs.insert_one(doc)
    return _serialize(doc)


@router.patch("/{log_id}")
async def update_log(
    log_id: str,
    data: ServiceLogUpdate,
    current_user: dict = Depends(require_customer),
    db=Depends(get_db),
):
    doc = await db.manual_service_logs.find_one(
        {"_id": log_id, "user_id": current_user["_id"]}
    )
    if not doc:
        raise HTTPException(404, "Log not found")

    updates: dict = {"updated_at": datetime.utcnow()}
    for field in ("service_date", "location", "services", "notes", "mileage", "cost", "next_service_months"):
        val = getattr(data, field)
        if val is not None:
            updates[field] = val

    await db.manual_service_logs.update_one({"_id": log_id}, {"$set": updates})
    return _serialize({**doc, **updates})


@router.delete("/{log_id}")
async def delete_log(
    log_id: str,
    current_user: dict = Depends(require_customer),
    db=Depends(get_db),
):
    result = await db.manual_service_logs.delete_one(
        {"_id": log_id, "user_id": current_user["_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(404, "Log not found")
    return {"message": "deleted"}
