from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from core.security import decode_token
from core.database import get_db

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db=Depends(get_db),
):
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = await db.users.find_one({"_id": payload["sub"]})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    if user.get("role") == "customer":
        token_sid = payload.get("sid")
        if not token_sid or token_sid != user.get("session_id"):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="SESSION_EXPIRED")

    return user


async def require_customer(user=Depends(get_current_user)):
    if user["role"] != "customer":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Customer access required")
    return user


async def require_workshop(user=Depends(get_current_user)):
    if user["role"] != "workshop":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Workshop access required")
    return user
