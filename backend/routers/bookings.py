from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime
from bson import ObjectId
from typing import Optional
from core.database import get_db
from core.socket_manager import emit_to_user, emit_to_booking_room
from core.notifications import push_notification
from middleware.auth import get_current_user, require_customer, require_workshop
from models.booking import (
    BookingCreate, BookingStatusUpdate, BookingStationAssign, BookingMechanicAssign,
    BookingReschedule, ServiceReport, ProductUsed,
    InsuranceClaimSubmit, InsuranceClaimStatusUpdate,
)
from routers.workshops import compute_queue_snapshot

router = APIRouter(prefix="/bookings", tags=["bookings"])


def _dt(v):
    return v.isoformat() if hasattr(v, "isoformat") else v


def _clean(obj):
    """Recursively convert any datetime objects to ISO strings (for socket.io JSON safety)."""
    if isinstance(obj, dict):
        return {k: _clean(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_clean(i) for i in obj]
    return _dt(obj)


def serialize_booking(b: dict) -> dict:
    return {
        "id": b["_id"],
        "customer_id": b["customer_id"],
        "customer_name": b["customer_name"],
        "customer_phone": b["customer_phone"],
        "workshop_id": b["workshop_id"],
        "workshop_name": b["workshop_name"],
        "workshop_address": b["workshop_address"],
        "services": _clean(b.get("services", [])),
        "vehicle_plate": b["vehicle_plate"],
        "vehicle_name": b["vehicle_name"],
        "vehicle_brand": b["vehicle_brand"],
        "scheduled_date": b["scheduled_date"],
        "scheduled_time": b["scheduled_time"],
        "notes": b.get("notes", ""),
        "status": b["status"],
        "completion_notes": b.get("completion_notes"),
        "next_service_months": b.get("next_service_months"),
        "service_reports": b.get("service_reports", []),
        "station_id": b.get("station_id"),
        "mechanic_id": b.get("mechanic_id"),
        "mechanic_name": b.get("mechanic_name"),
        "total_price": b["total_price"],
        "referral_discount": b.get("referral_discount", 0.0),
        "loyalty_points_used": b.get("loyalty_points_used", 0),
        "loyalty_discount": b.get("loyalty_discount", 0.0),
        "loyalty_points_earned": b.get("loyalty_points_earned", 0),
        "payment_type": b.get("payment_type", "self_pay"),
        "payment_status": b["payment_status"],
        "payment_intent_id": b.get("payment_intent_id"),
        "insurance_details": b.get("insurance_details"),
        "claim_status": b.get("claim_status"),
        "claim_note": b.get("claim_note"),
        "corporate_id": b.get("corporate_id"),
        "booked_for_other": b.get("booked_for_other", False),
        "guest_contact_name": b.get("guest_contact_name"),
        "guest_contact_phone": b.get("guest_contact_phone"),
        "guest_vehicle": b.get("guest_vehicle"),
        "created_at": _dt(b["created_at"]),
        "updated_at": _dt(b["updated_at"]),
    }


@router.post("/", status_code=201)
async def create_booking(data: BookingCreate, user=Depends(require_customer), db=Depends(get_db)):
    workshop = await db.workshops.find_one({"_id": data.workshop_id})
    if not workshop:
        raise HTTPException(status_code=404, detail="Workshop not found")

    services_map = {s["_id"]: s for s in workshop.get("services", [])}
    selected = []
    total = 0.0
    svc_names = []
    for sid in data.service_ids:
        svc = services_map.get(sid)
        if not svc:
            raise HTTPException(status_code=400, detail=f"Service {sid} not found")
        selected.append(svc)
        total += svc["price"]
        svc_names.append(svc["name"])

    # ── Referral discount ───────────────────────────────────────────────────
    referral_discount = 0.0
    referral_doc = None
    if data.referral_code:
        code = data.referral_code.strip().upper()
        referrer = await db.users.find_one({"referral_code": code})
        already_used = await db.referrals.find_one({"referee_id": user["_id"]})
        if referrer and referrer["_id"] != user["_id"] and not already_used:
            DISCOUNT_PCT = 0.10
            DISCOUNT_CAP = 50.0
            referral_discount = min(total * DISCOUNT_PCT, DISCOUNT_CAP)
            referral_doc = {
                "_id": str(ObjectId()),
                "referrer_id": referrer["_id"],
                "referee_id": user["_id"],
                "referee_name": user["name"],
                "booking_id": None,   # filled after insert
                "discount_amount": referral_discount,
                "reward_amount": 0.0,
                "status": "pending",
                "created_at": datetime.utcnow(),
            }

    discounted_total = max(total - referral_discount, 0)

    # ── Loyalty points redemption ────────────────────────────────────────────
    loyalty_discount = 0.0
    loyalty_points_used = 0
    if data.loyalty_points_used and data.loyalty_points_used >= 100:
        db_user = await db.users.find_one({"_id": user["_id"]})
        available = int(db_user.get("loyalty_points", 0))
        pts_requested = (data.loyalty_points_used // 100) * 100  # round down to 100s
        pts_to_use = min(pts_requested, available)
        # Can't pay more than the current discounted total with points
        max_pts_for_total = int(discounted_total / 0.01 // 100) * 100
        pts_to_use = min(pts_to_use, max_pts_for_total)
        if pts_to_use >= 100:
            loyalty_discount = pts_to_use * 0.01
            loyalty_points_used = pts_to_use

    final_total = max(discounted_total - loyalty_discount, 0)

    # ── Insurance / corporate fields ────────────────────────────────────────
    payment_type = data.payment_type or "self_pay"
    insurance_details = data.insurance_details.model_dump() if data.insurance_details else None
    claim_status = "submitted" if payment_type == "insurance" and insurance_details else None

    # Resolve corporate_id from the user's profile if payment_type is corporate
    corporate_id = None
    if payment_type == "corporate":
        db_user = await db.users.find_one({"_id": user["_id"]})
        corporate_id = db_user.get("corporate_id")
        if not corporate_id:
            raise HTTPException(status_code=400, detail="No corporate account linked to your profile")

    now = datetime.utcnow()
    booking = {
        "_id": str(ObjectId()),
        "customer_id": user["_id"],
        "customer_name": user["name"],
        "customer_phone": user["phone"],
        "workshop_id": workshop["_id"],
        "workshop_name": workshop["workshop_name"],
        "workshop_address": workshop["address"],
        "workshop_owner_id": workshop["owner_id"],
        "services": selected,
        "vehicle_plate": data.vehicle_plate,
        "vehicle_name": data.vehicle_name,
        "vehicle_brand": data.vehicle_brand,
        "scheduled_date": data.scheduled_date,
        "scheduled_time": data.scheduled_time,
        "notes": data.notes or "",
        "status": "pending",
        "total_price": final_total,
        "referral_discount": referral_discount,
        "loyalty_points_used": loyalty_points_used,
        "loyalty_discount": loyalty_discount,
        "loyalty_points_earned": 0,
        "payment_type": payment_type,
        "payment_status": "unpaid",
        "payment_intent_id": None,
        "insurance_details": insurance_details,
        "claim_status": claim_status,
        "claim_note": None,
        "corporate_id": corporate_id,
        "booked_for_other": data.booked_for_other or False,
        "guest_contact_name": data.guest_contact_name,
        "guest_contact_phone": data.guest_contact_phone,
        "guest_vehicle": data.guest_vehicle,
        "created_at": now,
        "updated_at": now,
    }
    await db.bookings.insert_one(booking)

    # Deduct loyalty points after successful booking creation
    if loyalty_points_used > 0:
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {"loyalty_points": -loyalty_points_used}})

    # Persist referral record
    if referral_doc:
        referral_doc["booking_id"] = booking["_id"]
        await db.referrals.insert_one(referral_doc)

    await emit_to_user(workshop["owner_id"], "new_booking", serialize_booking(booking))
    await push_notification(
        db, workshop["owner_id"], "new_booking",
        "New Booking Request",
        f"{data.vehicle_brand} {data.vehicle_name} ({data.vehicle_plate}) — {', '.join(svc_names)}",
        {"booking_id": booking["_id"]},
    )

    return serialize_booking(booking)


@router.get("/my")
async def get_my_bookings(
    status: Optional[str] = Query(None),
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    if user["role"] == "customer":
        query = {"customer_id": user["_id"]}
    else:
        workshop = await db.workshops.find_one({"owner_id": user["_id"]})
        if not workshop:
            return []
        query = {"workshop_id": workshop["_id"]}

    if status:
        query["status"] = status

    bookings = await db.bookings.find(query).sort("created_at", -1).to_list(100)

    booking_ids = [b["_id"] for b in bookings]
    reviewed_docs = await db.reviews.find({"booking_id": {"$in": booking_ids}}).to_list(None)
    reviewed_ids = {r["booking_id"] for r in reviewed_docs}

    result = []
    for b in bookings:
        serialized = serialize_booking(b)
        serialized["has_review"] = b["_id"] in reviewed_ids
        result.append(serialized)
    return result


@router.get("/{booking_id}")
async def get_booking(booking_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    b = await db.bookings.find_one({"_id": booking_id})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")

    if user["role"] == "customer" and b["customer_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if user["role"] == "workshop":
        workshop = await db.workshops.find_one({"owner_id": user["_id"]})
        if not workshop or b["workshop_id"] != workshop["_id"]:
            raise HTTPException(status_code=403, detail="Forbidden")

    serialized = serialize_booking(b)
    existing_review = await db.reviews.find_one({"booking_id": booking_id})
    serialized["has_review"] = existing_review is not None
    return serialized


@router.patch("/{booking_id}/status")
async def update_booking_status(
    booking_id: str,
    data: BookingStatusUpdate,
    user=Depends(require_workshop),
    db=Depends(get_db),
):
    b = await db.bookings.find_one({"_id": booking_id})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")

    workshop = await db.workshops.find_one({"owner_id": user["_id"]})
    if not workshop or b["workshop_id"] != workshop["_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    valid_transitions = {
        "pending": ["confirmed", "rejected"],
        "confirmed": ["in_progress", "cancelled"],
        "in_progress": ["completed"],
    }
    if data.status not in valid_transitions.get(b["status"], []):
        raise HTTPException(status_code=400, detail=f"Cannot transition from {b['status']} to {data.status}")

    if data.status == "completed":
        # Require at least a general note OR at least one service report with work done
        has_general = data.completion_notes and data.completion_notes.strip()
        has_service_reports = data.service_reports and len(data.service_reports) > 0
        if not has_general and not has_service_reports:
            raise HTTPException(status_code=400, detail="Please provide a general report or per-service work details")

    update = {"status": data.status, "updated_at": datetime.utcnow()}
    if data.note:
        update["status_note"] = data.note
    if data.status == "completed":
        update["completed_at"] = datetime.utcnow()
        update["completion_notes"] = (data.completion_notes or "").strip()
        if data.service_reports:
            update["service_reports"] = [r.dict() for r in data.service_reports]
            # Use the shortest next_service_months across all services as the overall recommendation
            months = [r.next_service_months for r in data.service_reports if r.next_service_months]
            update["next_service_months"] = min(months) if months else data.next_service_months
        else:
            update["next_service_months"] = data.next_service_months
            update["service_reports"] = []

    await db.bookings.update_one({"_id": booking_id}, {"$set": update})

    # Deduct inventory for all products used across service reports
    if data.status == "completed" and data.service_reports:
        for report in data.service_reports:
            if not report.products_used:
                continue
            for pu in report.products_used:
                if pu.quantity > 0:
                    await db.workshops.update_one(
                        {"_id": b["workshop_id"], "products._id": pu.product_id},
                        {"$inc": {"products.$.quantity": -pu.quantity}},
                    )

        # Check reorder thresholds after deduction
        deducted_ids = {pu.product_id for r in data.service_reports if r.products_used for pu in r.products_used if pu.quantity > 0}
        if deducted_ids:
            wshop = await db.workshops.find_one({"_id": b["workshop_id"]})
            if wshop:
                for prod in wshop.get("products", []):
                    threshold = prod.get("reorder_threshold", 0)
                    qty = prod.get("quantity", 0)
                    if prod["_id"] in deducted_ids and threshold > 0 and qty <= threshold:
                        pname = prod.get("name", "Product")
                        brand = prod.get("brand", "")
                        unit = prod.get("unit", "pcs")
                        label = f"{pname}" + (f" ({brand})" if brand else "")
                        await push_notification(
                            db, b["workshop_owner_id"], "low_stock",
                            "Low Stock Alert ⚠️",
                            f"{label} running low — {qty:.0f} {unit} left.",
                            {"workshop_id": b["workshop_id"], "product_id": prod["_id"]}
                        )

    updated = await db.bookings.find_one({"_id": booking_id})

    # Refresh queue snapshot whenever active job count changes
    if data.status in ("in_progress", "completed"):
        await compute_queue_snapshot(b["workshop_id"], db)

    await emit_to_user(b["customer_id"], "booking_status_updated", serialize_booking(updated))
    await emit_to_booking_room(booking_id, "booking_status_updated", serialize_booking(updated))

    # Notify customer of status change
    status_notifs = {
        "confirmed":   ("Booking Confirmed ✅", f"Your booking at {b['workshop_name']} has been confirmed."),
        "rejected":    ("Booking Rejected ❌", f"Your booking at {b['workshop_name']} was not accepted."),
        "in_progress": ("Service Started 🔧", f"Your vehicle is now being serviced at {b['workshop_name']}."),
        "completed":   ("Service Completed ✅", f"Your vehicle service at {b['workshop_name']} is complete. Tap to review."),
    }
    if data.status in status_notifs:
        title, body = status_notifs[data.status]
        await push_notification(db, b["customer_id"], f"booking_{data.status}", title, body, {"booking_id": booking_id})

    # ── Referral reward on completion ────────────────────────────────────────
    if data.status == "completed":
        referral_rec = await db.referrals.find_one({"booking_id": booking_id, "status": "pending"})
        if referral_rec:
            REWARD_RM = 20.0
            await db.referrals.update_one(
                {"_id": referral_rec["_id"]},
                {"$set": {"status": "rewarded", "reward_amount": REWARD_RM}},
            )
            await db.users.update_one(
                {"_id": referral_rec["referrer_id"]},
                {"$inc": {"referral_credits": REWARD_RM}},
            )
            await push_notification(
                db, referral_rec["referrer_id"], "referral_reward",
                "Referral Reward Earned! 🎉",
                f"You earned RM{REWARD_RM:.0f} credit — your referral just completed their first service.",
                {"booking_id": booking_id},
            )

    # ── Award loyalty points on completion ───────────────────────────────────
    if data.status == "completed":
        pts_earned = int(updated.get("total_price", 0))  # 1 pt per RM1 of final price
        if pts_earned > 0:
            await db.users.update_one({"_id": b["customer_id"]}, {"$inc": {"loyalty_points": pts_earned}})
            await db.bookings.update_one({"_id": booking_id}, {"$set": {"loyalty_points_earned": pts_earned}})
            await push_notification(
                db, b["customer_id"], "loyalty_reward",
                "Points Earned! ⭐",
                f"You earned {pts_earned} loyalty points from your service at {b['workshop_name']}.",
                {"booking_id": booking_id},
            )

    return serialize_booking(updated)


@router.patch("/{booking_id}/cancel")
async def cancel_booking(booking_id: str, user=Depends(require_customer), db=Depends(get_db)):
    b = await db.bookings.find_one({"_id": booking_id})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    if b["customer_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if b["status"] not in ["pending", "confirmed"]:
        raise HTTPException(status_code=400, detail="Cannot cancel at this stage")

    await db.bookings.update_one(
        {"_id": booking_id},
        {"$set": {"status": "cancelled", "updated_at": datetime.utcnow()}},
    )
    updated = await db.bookings.find_one({"_id": booking_id})
    await emit_to_user(b["workshop_owner_id"], "booking_status_updated", serialize_booking(updated))
    await push_notification(
        db, b["workshop_owner_id"], "booking_cancelled",
        "Booking Cancelled",
        f"{b['customer_name']} cancelled their booking for {b['vehicle_plate']}.",
        {"booking_id": booking_id},
    )
    return serialize_booking(updated)


@router.patch("/{booking_id}/reschedule")
async def reschedule_booking(booking_id: str, data: BookingReschedule, user=Depends(require_customer), db=Depends(get_db)):
    b = await db.bookings.find_one({"_id": booking_id})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    if b["customer_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if b["status"] not in ["pending", "confirmed"]:
        raise HTTPException(status_code=400, detail="Cannot reschedule — service has already started or the booking is no longer active")

    await db.bookings.update_one(
        {"_id": booking_id},
        {"$set": {"scheduled_date": data.scheduled_date, "scheduled_time": data.scheduled_time, "updated_at": datetime.utcnow()}},
    )
    updated = await db.bookings.find_one({"_id": booking_id})
    await emit_to_user(b["workshop_owner_id"], "booking_status_updated", serialize_booking(updated))
    await push_notification(
        db, b["workshop_owner_id"], "booking_rescheduled",
        "Booking Rescheduled 📅",
        f"{b['customer_name']} rescheduled to {data.scheduled_date} at {data.scheduled_time}.",
        {"booking_id": booking_id},
    )
    return serialize_booking(updated)


@router.patch("/{booking_id}/station")
async def assign_station(booking_id: str, data: BookingStationAssign, user=Depends(require_workshop), db=Depends(get_db)):
    b = await db.bookings.find_one({"_id": booking_id})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    workshop = await db.workshops.find_one({"owner_id": user["_id"]})
    if not workshop or b["workshop_id"] != workshop["_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.bookings.update_one(
        {"_id": booking_id},
        {"$set": {"station_id": data.station_id, "updated_at": datetime.utcnow()}},
    )
    updated = await db.bookings.find_one({"_id": booking_id})
    return serialize_booking(updated)


@router.patch("/{booking_id}/mechanic")
async def assign_mechanic(booking_id: str, data: BookingMechanicAssign, user=Depends(require_workshop), db=Depends(get_db)):
    b = await db.bookings.find_one({"_id": booking_id})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    if b["workshop_owner_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    mechanic_name = None
    if data.mechanic_id:
        workshop = await db.workshops.find_one({"owner_id": user["_id"]})
        mechanic = next((m for m in workshop.get("mechanics", []) if m["_id"] == data.mechanic_id), None)
        if not mechanic:
            raise HTTPException(status_code=404, detail="Mechanic not found")
        mechanic_name = mechanic["name"]

    await db.bookings.update_one(
        {"_id": booking_id},
        {"$set": {"mechanic_id": data.mechanic_id, "mechanic_name": mechanic_name, "updated_at": datetime.utcnow()}}
    )
    updated = await db.bookings.find_one({"_id": booking_id})
    return serialize_booking(updated)


# ── Insurance Claim Endpoints ────────────────────────────────────────────────

@router.patch("/{booking_id}/insurance")
async def submit_insurance_claim(booking_id: str, data: InsuranceClaimSubmit, user=Depends(require_customer), db=Depends(get_db)):
    """Customer submits / updates insurance claim details."""
    b = await db.bookings.find_one({"_id": booking_id})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    if b["customer_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    insurance_details = data.model_dump()
    await db.bookings.update_one(
        {"_id": booking_id},
        {"$set": {
            "payment_type": "insurance",
            "insurance_details": insurance_details,
            "claim_status": "submitted",
            "updated_at": datetime.utcnow(),
        }},
    )
    # Notify workshop
    workshop = await db.workshops.find_one({"_id": b["workshop_id"]})
    if workshop:
        await push_notification(
            db, workshop["owner_id"], "insurance_claim",
            "Insurance Claim Submitted",
            f"{b['customer_name']} submitted an insurance claim for booking {booking_id[-6:].upper()}.",
            {"booking_id": booking_id},
        )
    updated = await db.bookings.find_one({"_id": booking_id})
    return serialize_booking(updated)


@router.patch("/{booking_id}/insurance-status")
async def update_insurance_claim_status(booking_id: str, data: InsuranceClaimStatusUpdate, user=Depends(require_workshop), db=Depends(get_db)):
    """Workshop updates claim processing status."""
    b = await db.bookings.find_one({"_id": booking_id})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    if b["workshop_owner_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if b.get("payment_type") != "insurance":
        raise HTTPException(status_code=400, detail="This booking is not an insurance claim")

    valid_statuses = {"submitted", "processing", "approved", "rejected"}
    if data.claim_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid claim status. Must be one of: {', '.join(valid_statuses)}")

    await db.bookings.update_one(
        {"_id": booking_id},
        {"$set": {
            "claim_status": data.claim_status,
            "claim_note": data.claim_note,
            "updated_at": datetime.utcnow(),
        }},
    )
    status_labels = {
        "submitted": "Submitted",
        "processing": "In Processing",
        "approved": "Approved ✅",
        "rejected": "Rejected ❌",
    }
    await push_notification(
        db, b["customer_id"], "insurance_claim_update",
        f"Insurance Claim {status_labels[data.claim_status]}",
        f"Your insurance claim for {b['workshop_name']} has been updated to: {status_labels[data.claim_status]}.",
        {"booking_id": booking_id},
    )
    updated = await db.bookings.find_one({"_id": booking_id})
    return serialize_booking(updated)
