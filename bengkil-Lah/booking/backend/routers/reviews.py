from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from bson import ObjectId
from core.database import get_db
from middleware.auth import get_current_user, require_customer
from models.review import ReviewCreate

router = APIRouter(prefix="/reviews", tags=["reviews"])


def serialize_review(r: dict) -> dict:
    created = r["created_at"]
    return {
        "id": r["_id"],
        "booking_id": r["booking_id"],
        "workshop_id": r["workshop_id"],
        "workshop_name": r.get("workshop_name", ""),
        "customer_id": r["customer_id"],
        "customer_name": r["customer_name"],
        "rating": r["rating"],
        "comment": r.get("comment", ""),
        "created_at": created.isoformat() if hasattr(created, "isoformat") else created,
    }


@router.post("/", status_code=201)
async def create_review(data: ReviewCreate, user=Depends(require_customer), db=Depends(get_db)):
    booking = await db.bookings.find_one({"_id": data.booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking["customer_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if booking["status"] != "completed":
        raise HTTPException(status_code=400, detail="Booking must be completed before reviewing")

    existing = await db.reviews.find_one({"booking_id": data.booking_id})
    if existing:
        raise HTTPException(status_code=400, detail="Already reviewed this booking")

    review = {
        "_id": str(ObjectId()),
        "booking_id": data.booking_id,
        "workshop_id": booking["workshop_id"],
        "workshop_name": booking.get("workshop_name", ""),
        "customer_id": user["_id"],
        "customer_name": user["name"],
        "rating": data.rating,
        "comment": data.comment or "",
        "created_at": datetime.utcnow(),
    }
    await db.reviews.insert_one(review)

    all_reviews = await db.reviews.find({"workshop_id": booking["workshop_id"]}).to_list(None)
    avg = sum(r["rating"] for r in all_reviews) / len(all_reviews)
    await db.workshops.update_one(
        {"_id": booking["workshop_id"]},
        {"$set": {"rating": round(avg, 1), "total_reviews": len(all_reviews)}},
    )

    return serialize_review(review)


@router.get("/my")
async def get_my_reviews(user=Depends(require_customer), db=Depends(get_db)):
    reviews = await db.reviews.find({"customer_id": user["_id"]}).sort("created_at", -1).to_list(100)
    return [serialize_review(r) for r in reviews]


@router.get("/workshop/{workshop_id}")
async def get_workshop_reviews(workshop_id: str, db=Depends(get_db)):
    reviews = await db.reviews.find({"workshop_id": workshop_id}).sort("created_at", -1).to_list(50)
    return [serialize_review(r) for r in reviews]


@router.get("/booking/{booking_id}")
async def get_booking_review(booking_id: str, user=Depends(get_current_user), db=Depends(get_db)):
    review = await db.reviews.find_one({"booking_id": booking_id})
    if not review:
        return None
    return serialize_review(review)
