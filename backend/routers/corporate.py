from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime
from bson import ObjectId
from typing import Optional
from core.database import get_db
from middleware.auth import get_current_user, require_customer
from models.corporate import (
    CorporateRegister, CorporateUpdate,
    CorporateVehicleCreate, CorporateVehicleUpdate, DriverInvite,
)

router = APIRouter(prefix="/corporate", tags=["corporate"])


def serialize_corporate(c: dict) -> dict:
    return {
        "id": c["_id"],
        "company_name": c["company_name"],
        "registration_no": c["registration_no"],
        "contact_email": c["contact_email"],
        "contact_phone": c["contact_phone"],
        "monthly_limit": c.get("monthly_limit", 0.0),
        "admin_user_id": c["admin_user_id"],
        "vehicles": c.get("vehicles", []),
        "driver_ids": c.get("driver_ids", []),
        "created_at": c["created_at"].isoformat() if hasattr(c["created_at"], "isoformat") else c["created_at"],
    }


async def _get_corporate_for_user(user: dict, db) -> Optional[dict]:
    """Return corporate account where user is admin or driver."""
    corp = await db.corporate_accounts.find_one({"admin_user_id": user["_id"]})
    if corp:
        return corp
    corp = await db.corporate_accounts.find_one({"driver_ids": user["_id"]})
    return corp


@router.post("/register", status_code=201)
async def register_corporate(data: CorporateRegister, user=Depends(require_customer), db=Depends(get_db)):
    existing = await _get_corporate_for_user(user, db)
    if existing:
        raise HTTPException(status_code=400, detail="You already belong to a corporate account")

    now = datetime.utcnow()
    doc = {
        "_id": str(ObjectId()),
        "admin_user_id": user["_id"],
        "company_name": data.company_name,
        "registration_no": data.registration_no,
        "contact_email": data.contact_email,
        "contact_phone": data.contact_phone,
        "monthly_limit": data.monthly_limit,
        "vehicles": [],
        "driver_ids": [],
        "created_at": now,
        "updated_at": now,
    }
    await db.corporate_accounts.insert_one(doc)
    # Tag the admin user
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"corporate_id": doc["_id"], "corporate_role": "admin"}})
    return serialize_corporate(doc)


@router.get("/my")
async def get_my_corporate(user=Depends(get_current_user), db=Depends(get_db)):
    corp = await _get_corporate_for_user(user, db)
    if not corp:
        raise HTTPException(status_code=404, detail="No corporate account found")

    result = serialize_corporate(corp)
    # Enrich drivers with names
    if corp.get("driver_ids"):
        drivers = await db.users.find({"_id": {"$in": corp["driver_ids"]}}).to_list(None)
        result["drivers"] = [{"id": d["_id"], "name": d["name"], "email": d["email"], "phone": d.get("phone", "")} for d in drivers]
    else:
        result["drivers"] = []
    result["is_admin"] = corp["admin_user_id"] == user["_id"]
    return result


@router.patch("/my")
async def update_corporate(data: CorporateUpdate, user=Depends(require_customer), db=Depends(get_db)):
    corp = await db.corporate_accounts.find_one({"admin_user_id": user["_id"]})
    if not corp:
        raise HTTPException(status_code=403, detail="Only the corporate admin can update account details")
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    update["updated_at"] = datetime.utcnow()
    await db.corporate_accounts.update_one({"_id": corp["_id"]}, {"$set": update})
    updated = await db.corporate_accounts.find_one({"_id": corp["_id"]})
    return serialize_corporate(updated)


# ── Vehicles ────────────────────────────────────────────────────────────────

@router.post("/vehicles", status_code=201)
async def add_vehicle(data: CorporateVehicleCreate, user=Depends(require_customer), db=Depends(get_db)):
    corp = await db.corporate_accounts.find_one({"admin_user_id": user["_id"]})
    if not corp:
        raise HTTPException(status_code=403, detail="Only admin can manage fleet vehicles")
    vehicle = {"_id": str(ObjectId()), **data.model_dump()}
    await db.corporate_accounts.update_one({"_id": corp["_id"]}, {"$push": {"vehicles": vehicle}})
    return vehicle


@router.patch("/vehicles/{vehicle_id}")
async def update_vehicle(vehicle_id: str, data: CorporateVehicleUpdate, user=Depends(require_customer), db=Depends(get_db)):
    corp = await db.corporate_accounts.find_one({"admin_user_id": user["_id"]})
    if not corp:
        raise HTTPException(status_code=403, detail="Only admin can manage fleet vehicles")
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    set_fields = {f"vehicles.$.{k}": v for k, v in update.items()}
    await db.corporate_accounts.update_one(
        {"_id": corp["_id"], "vehicles._id": vehicle_id},
        {"$set": set_fields},
    )
    updated = await db.corporate_accounts.find_one({"_id": corp["_id"]})
    return next((v for v in updated["vehicles"] if v["_id"] == vehicle_id), None)


@router.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: str, user=Depends(require_customer), db=Depends(get_db)):
    corp = await db.corporate_accounts.find_one({"admin_user_id": user["_id"]})
    if not corp:
        raise HTTPException(status_code=403, detail="Only admin can manage fleet vehicles")
    await db.corporate_accounts.update_one(
        {"_id": corp["_id"]},
        {"$pull": {"vehicles": {"_id": vehicle_id}}},
    )
    return {"ok": True}


# ── Drivers ─────────────────────────────────────────────────────────────────

@router.post("/drivers/invite")
async def invite_driver(data: DriverInvite, user=Depends(require_customer), db=Depends(get_db)):
    corp = await db.corporate_accounts.find_one({"admin_user_id": user["_id"]})
    if not corp:
        raise HTTPException(status_code=403, detail="Only admin can manage drivers")
    driver = await db.users.find_one({"email": data.email, "role": "customer"})
    if not driver:
        raise HTTPException(status_code=404, detail="No customer account found with that email")
    if driver["_id"] == user["_id"]:
        raise HTTPException(status_code=400, detail="Admin is already part of the account")
    if driver["_id"] in corp.get("driver_ids", []):
        raise HTTPException(status_code=400, detail="User is already a driver in this account")
    await db.corporate_accounts.update_one({"_id": corp["_id"]}, {"$addToSet": {"driver_ids": driver["_id"]}})
    await db.users.update_one({"_id": driver["_id"]}, {"$set": {"corporate_id": corp["_id"], "corporate_role": "driver"}})
    return {"id": driver["_id"], "name": driver["name"], "email": driver["email"]}


@router.delete("/drivers/{driver_id}")
async def remove_driver(driver_id: str, user=Depends(require_customer), db=Depends(get_db)):
    corp = await db.corporate_accounts.find_one({"admin_user_id": user["_id"]})
    if not corp:
        raise HTTPException(status_code=403, detail="Only admin can manage drivers")
    await db.corporate_accounts.update_one({"_id": corp["_id"]}, {"$pull": {"driver_ids": driver_id}})
    await db.users.update_one({"_id": driver_id}, {"$unset": {"corporate_id": "", "corporate_role": ""}})
    return {"ok": True}


# ── Billing ──────────────────────────────────────────────────────────────────

@router.get("/billing")
async def corporate_billing(
    month: Optional[str] = Query(None, description="YYYY-MM, defaults to current month"),
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    corp = await _get_corporate_for_user(user, db)
    if not corp:
        raise HTTPException(status_code=404, detail="No corporate account found")

    if not month:
        now = datetime.utcnow()
        month = f"{now.year}-{now.month:02d}"

    year, mon = int(month.split("-")[0]), int(month.split("-")[1])
    from datetime import timezone
    month_start = datetime(year, mon, 1)
    if mon == 12:
        month_end = datetime(year + 1, 1, 1)
    else:
        month_end = datetime(year, mon + 1, 1)

    bookings = await db.bookings.find({
        "corporate_id": corp["_id"],
        "created_at": {"$gte": month_start, "$lt": month_end},
    }).sort("created_at", -1).to_list(200)

    total = sum(b.get("total_price", 0) for b in bookings)
    paid = sum(b.get("total_price", 0) for b in bookings if b.get("payment_status") == "paid")
    pending = total - paid

    serialized = []
    for b in bookings:
        serialized.append({
            "id": b["_id"],
            "customer_name": b.get("customer_name", ""),
            "workshop_name": b.get("workshop_name", ""),
            "services": [s["name"] for s in b.get("services", [])],
            "vehicle_plate": b.get("vehicle_plate", ""),
            "scheduled_date": b.get("scheduled_date", ""),
            "status": b.get("status", ""),
            "payment_status": b.get("payment_status", ""),
            "total_price": b.get("total_price", 0),
            "created_at": b["created_at"].isoformat() if hasattr(b["created_at"], "isoformat") else b["created_at"],
        })

    return {
        "month": month,
        "corporate_id": corp["_id"],
        "company_name": corp["company_name"],
        "total_bookings": len(bookings),
        "total_amount": total,
        "paid_amount": paid,
        "pending_amount": pending,
        "monthly_limit": corp.get("monthly_limit", 0.0),
        "bookings": serialized,
    }
