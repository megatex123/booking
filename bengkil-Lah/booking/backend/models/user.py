from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


class UserRegister(BaseModel):
    name: str = Field(..., min_length=2)
    email: EmailStr
    password: str = Field(..., min_length=6)
    phone: str
    role: str = Field(..., pattern="^(customer|workshop)$")


class CustomerRegister(UserRegister):
    role: str = "customer"


class WorkshopRegister(UserRegister):
    role: str = "workshop"
    workshop_name: str
    workshop_address: str
    latitude: float
    longitude: float
    description: Optional[str] = ""


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    role: str
    avatar: Optional[str] = None
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class VehicleInfo(BaseModel):
    name: str
    plate: str
    brand: str
    year: Optional[int] = None
    color: Optional[str] = None


class UpdateProfile(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    vehicles: Optional[list[VehicleInfo]] = None
    avatar: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str = Field(..., min_length=6)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)
