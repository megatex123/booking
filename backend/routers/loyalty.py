from fastapi import APIRouter, Depends
from core.database import get_db
from middleware.auth import require_customer

router = APIRouter(prefix="/loyalty", tags=["loyalty"])

POINTS_PER_RM = 1      # earn 1 pt per RM1 spent
POINTS_TO_RM = 0.01    # 1 pt = RM0.01  (100 pts = RM1)
MIN_REDEEM = 100       # minimum points to redeem at once


@router.get("/balance")
async def get_balance(user=Depends(require_customer), db=Depends(get_db)):
    u = await db.users.find_one({"_id": user["_id"]})
    points = int(u.get("loyalty_points", 0))
    total_earned = 0
    total_used = 0
    async for b in db.bookings.find({"customer_id": user["_id"], "loyalty_points_earned": {"$gt": 0}}):
        total_earned += int(b.get("loyalty_points_earned", 0))
    async for b in db.bookings.find({"customer_id": user["_id"], "loyalty_points_used": {"$gt": 0}}):
        total_used += int(b.get("loyalty_points_used", 0))
    return {
        "points": points,
        "total_earned": total_earned,
        "total_used": total_used,
        "rm_value": round(points * POINTS_TO_RM, 2),
        "min_redeem": MIN_REDEEM,
        "points_per_rm": POINTS_PER_RM,
        "points_to_rm": POINTS_TO_RM,
    }


@router.get("/history")
async def get_history(user=Depends(require_customer), db=Depends(get_db)):
    cursor = db.bookings.find({
        "customer_id": user["_id"],
        "$or": [{"loyalty_points_earned": {"$gt": 0}}, {"loyalty_points_used": {"$gt": 0}}],
    }).sort("created_at", -1).limit(50)
    history = []
    async for b in cursor:
        history.append({
            "booking_id": b["_id"],
            "workshop_name": b["workshop_name"],
            "total_price": b["total_price"],
            "status": b["status"],
            "points_earned": int(b.get("loyalty_points_earned", 0)),
            "points_used": int(b.get("loyalty_points_used", 0)),
            "discount_rm": b.get("loyalty_discount", 0.0),
            "created_at": b["created_at"].isoformat(),
        })
    return history
