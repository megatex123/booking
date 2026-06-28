import random
import string
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from bson import ObjectId
from core.database import get_db
from middleware.auth import get_current_user, require_customer
from models.referral import ReferralCodeValidate

router = APIRouter(prefix="/referrals", tags=["referrals"])

REFERRAL_DISCOUNT_PCT = 0.10   # 10% off for referee
REFERRAL_DISCOUNT_CAP = 50.0   # RM50 max discount
REFERRAL_REWARD_RM = 20.0      # RM20 credit for referrer when booking completes


def generate_code(length: int = 6) -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=length))


async def get_or_create_referral_code(user: dict, db) -> str:
    """Ensure the user has a referral_code; generate one if missing."""
    if user.get("referral_code"):
        return user["referral_code"]
    # Generate a unique code
    for _ in range(10):
        code = generate_code()
        existing = await db.users.find_one({"referral_code": code})
        if not existing:
            await db.users.update_one({"_id": user["_id"]}, {"$set": {"referral_code": code}})
            return code
    raise HTTPException(status_code=500, detail="Could not generate referral code")


@router.get("/my-code")
async def my_referral_code(user=Depends(get_current_user), db=Depends(get_db)):
    db_user = await db.users.find_one({"_id": user["_id"]})
    code = await get_or_create_referral_code(db_user, db)

    total = await db.referrals.count_documents({"referrer_id": user["_id"]})
    rewarded = await db.referrals.count_documents({"referrer_id": user["_id"], "status": "rewarded"})
    pending = await db.referrals.count_documents({"referrer_id": user["_id"], "status": "pending"})

    return {
        "code": code,
        "credits": db_user.get("referral_credits", 0.0),
        "total_referrals": total,
        "rewarded_referrals": rewarded,
        "pending_referrals": pending,
        "reward_per_referral": REFERRAL_REWARD_RM,
        "discount_pct": int(REFERRAL_DISCOUNT_PCT * 100),
        "discount_cap": REFERRAL_DISCOUNT_CAP,
    }


@router.post("/validate")
async def validate_referral_code(data: ReferralCodeValidate, user=Depends(require_customer), db=Depends(get_db)):
    """Check whether a referral code is valid (used in booking flow before submission)."""
    code = data.code.strip().upper()
    referrer = await db.users.find_one({"referral_code": code})
    if not referrer:
        raise HTTPException(status_code=404, detail="Invalid referral code")
    if referrer["_id"] == user["_id"]:
        raise HTTPException(status_code=400, detail="You cannot use your own referral code")
    # Check not already used by this user
    already = await db.referrals.find_one({"referee_id": user["_id"]})
    if already:
        raise HTTPException(status_code=400, detail="You have already used a referral code")
    return {
        "valid": True,
        "referrer_name": referrer["name"],
        "discount_pct": int(REFERRAL_DISCOUNT_PCT * 100),
        "discount_cap": REFERRAL_DISCOUNT_CAP,
    }


@router.get("/history")
async def referral_history(user=Depends(get_current_user), db=Depends(get_db)):
    docs = await db.referrals.find({"referrer_id": user["_id"]}).sort("created_at", -1).to_list(50)
    result = []
    for d in docs:
        result.append({
            "id": d["_id"],
            "referee_name": d.get("referee_name", ""),
            "booking_id": d.get("booking_id"),
            "discount_given": d.get("discount_amount", 0),
            "reward_earned": d.get("reward_amount", 0),
            "status": d["status"],
            "created_at": d["created_at"].isoformat() if hasattr(d["created_at"], "isoformat") else d["created_at"],
        })
    return result
