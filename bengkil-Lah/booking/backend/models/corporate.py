from pydantic import BaseModel
from typing import Optional, List


class CorporateVehicle(BaseModel):
    plate: str
    make: str
    model: str
    year: Optional[str] = ""


class CorporateRegister(BaseModel):
    company_name: str
    registration_no: str
    contact_email: str
    contact_phone: str
    monthly_limit: float = 0.0  # 0 = unlimited


class CorporateUpdate(BaseModel):
    company_name: Optional[str] = None
    registration_no: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    monthly_limit: Optional[float] = None


class CorporateVehicleCreate(BaseModel):
    plate: str
    make: str
    model: str
    year: Optional[str] = ""


class CorporateVehicleUpdate(BaseModel):
    plate: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[str] = None


class DriverInvite(BaseModel):
    email: str  # existing user email to link as driver
