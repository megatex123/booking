from fastapi import APIRouter, HTTPException, Depends, status
from datetime import datetime, timedelta
import random
import string
import uuid
from bson import ObjectId
from core.database import get_db
from core.security import hash_password, verify_password, create_access_token
from middleware.auth import get_current_user
from models.user import (
    UserLogin, UserRegister, WorkshopRegister, CustomerRegister,
    TokenResponse, UserResponse,
    ForgotPasswordRequest, ResetPasswordRequest, ChangePasswordRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _generate_referral_code() -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


def serialize_user(user: dict) -> UserResponse:
    return UserResponse(
        id=str(user["_id"]),
        name=user["name"],
        email=user["email"],
        phone=user["phone"],
        role=user["role"],
        avatar=user.get("avatar"),
        address=user.get("address"),
        created_at=user["created_at"],
    )


@router.post("/register/customer", response_model=TokenResponse, status_code=201)
async def register_customer(data: CustomerRegister, db=Depends(get_db)):
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    now = datetime.utcnow()
    user_doc = {
        "_id": str(ObjectId()),
        "name": data.name,
        "email": data.email,
        "password": hash_password(data.password),
        "phone": data.phone,
        "role": "customer",
        "vehicles": [],
        "avatar": None,
        "address": data.address or None,
        "referral_code": _generate_referral_code(),
        "referral_credits": 0.0,
        "loyalty_points": 0,
        "created_at": now,
        "updated_at": now,
    }
    session_id = str(uuid.uuid4())
    user_doc["session_id"] = session_id
    await db.users.insert_one(user_doc)
    token = create_access_token({"sub": user_doc["_id"], "role": "customer", "sid": session_id})
    return TokenResponse(access_token=token, user=serialize_user(user_doc))


@router.post("/register/workshop", response_model=TokenResponse, status_code=201)
async def register_workshop(data: WorkshopRegister, db=Depends(get_db)):
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    now = datetime.utcnow()
    user_doc = {
        "_id": str(ObjectId()),
        "name": data.name,
        "email": data.email,
        "password": hash_password(data.password),
        "phone": data.phone,
        "role": "workshop",
        "avatar": None,
        "created_at": now,
        "updated_at": now,
    }
    await db.users.insert_one(user_doc)

    default_hours = {
        day: {"open": "08:00", "close": "17:00", "is_open": day not in ["sunday"]}
        for day in ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    }
    workshop_doc = {
        "_id": str(ObjectId()),
        "owner_id": user_doc["_id"],
        "workshop_name": data.workshop_name,
        "description": data.description or "",
        "address": data.workshop_address,
        "phone": data.phone,
        "location": {
            "type": "Point",
            "coordinates": [data.longitude, data.latitude],
        },
        "latitude": data.latitude,
        "longitude": data.longitude,
        "rating": 0.0,
        "total_reviews": 0,
        "is_open": True,
        "working_hours": default_hours,
        "images": [],
        "services": [],
        "created_at": now,
        "updated_at": now,
    }
    await db.workshops.insert_one(workshop_doc)

    token = create_access_token({"sub": user_doc["_id"], "role": "workshop"})
    return TokenResponse(access_token=token, user=serialize_user(user_doc))


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, db=Depends(get_db)):
    user = await db.users.find_one({"email": data.email})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    payload: dict = {"sub": user["_id"], "role": user["role"]}
    if user["role"] == "customer":
        session_id = str(uuid.uuid4())
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"session_id": session_id}})
        payload["sid"] = session_id

    token = create_access_token(payload)
    return TokenResponse(access_token=token, user=serialize_user(user))


@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest, db=Depends(get_db)):
    user = await db.users.find_one({"email": data.email})
    if not user:
        # Return success anyway to avoid email enumeration
        return {"message": "If this email is registered, an OTP has been sent.", "demo_otp": None}

    otp = f"{random.randint(100000, 999999)}"
    expires = datetime.utcnow() + timedelta(minutes=15)
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"reset_otp": otp, "reset_otp_expires": expires}},
    )
    # In production this would send an email; for demo we return it directly
    return {"message": "OTP sent to your email.", "demo_otp": otp}


@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest, db=Depends(get_db)):
    user = await db.users.find_one({"email": data.email})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid request")

    stored_otp = user.get("reset_otp")
    expires = user.get("reset_otp_expires")
    if not stored_otp or stored_otp != data.otp:
        raise HTTPException(status_code=400, detail="Invalid or incorrect OTP")
    if not expires or datetime.utcnow() > expires:
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")

    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"password": hash_password(data.new_password), "updated_at": datetime.utcnow()},
            "$unset": {"reset_otp": "", "reset_otp_expires": ""},
        },
    )
    return {"message": "Password reset successfully. You can now log in."}


@router.patch("/change-password")
async def change_password(data: ChangePasswordRequest, user=Depends(get_current_user), db=Depends(get_db)):
    db_user = await db.users.find_one({"_id": user["_id"]})
    if not db_user or not verify_password(data.current_password, db_user["password"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"password": hash_password(data.new_password), "updated_at": datetime.utcnow()}},
    )
    return {"message": "Password changed successfully"}
