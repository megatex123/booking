from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime
from typing import List
from core.database import get_db
from core.socket_manager import connected_users
from core.feature_flags import get_merged_flags
from middleware.auth import get_current_user, require_workshop
from models.user import UpdateProfile, UserResponse

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me/flags")
async def get_my_flags(user=Depends(get_current_user), db=Depends(get_db)):
    """Returns global feature flags merged with any per-user overrides for the caller."""
    return await get_merged_flags(db, user["_id"])


@router.get("/me", response_model=UserResponse)
async def get_me(user=Depends(get_current_user)):
    return UserResponse(
        id=user["_id"],
        name=user["name"],
        email=user["email"],
        phone=user["phone"],
        role=user["role"],
        avatar=user.get("avatar"),
        address=user.get("address"),
        created_at=user["created_at"],
    )


@router.patch("/me")
async def update_profile(data: UpdateProfile, user=Depends(get_current_user), db=Depends(get_db)):
    update = {"updated_at": datetime.utcnow()}
    if data.name:
        update["name"] = data.name
    if data.phone:
        update["phone"] = data.phone
    if data.address is not None:
        update["address"] = data.address
    if data.vehicles is not None:
        update["vehicles"] = [v.dict() for v in data.vehicles]
    if data.avatar:
        update["avatar"] = data.avatar

    await db.users.update_one({"_id": user["_id"]}, {"$set": update})
    updated = await db.users.find_one({"_id": user["_id"]})
    return UserResponse(
        id=updated["_id"],
        name=updated["name"],
        email=updated["email"],
        phone=updated["phone"],
        role=updated["role"],
        avatar=updated.get("avatar"),
        address=updated.get("address"),
        created_at=updated["created_at"],
    )


@router.get("/me/vehicles")
async def get_vehicles(user=Depends(get_current_user)):
    return user.get("vehicles", [])


@router.get("/online-status")
async def online_status(user_ids: List[str] = Query(...), _user=Depends(require_workshop)):
    return {uid: (uid in connected_users and len(connected_users[uid]) > 0) for uid in user_ids}
