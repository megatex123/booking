from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class InsuranceDetails(BaseModel):
    provider: str                   # e.g. "takaful", "etiqa"
    policy_number: str
    incident_date: str              # YYYY-MM-DD
    claim_number: Optional[str] = ""


class BookingCreate(BaseModel):
    workshop_id: str
    service_ids: List[str]
    vehicle_plate: str
    vehicle_name: str
    vehicle_brand: str
    scheduled_date: str  # ISO date string
    scheduled_time: str  # HH:MM
    notes: Optional[str] = ""
    referral_code: Optional[str] = None
    loyalty_points_used: Optional[int] = 0
    payment_type: Optional[str] = "self_pay"   # "self_pay" | "insurance" | "corporate"
    insurance_details: Optional[InsuranceDetails] = None
    corporate_id: Optional[str] = None          # set automatically from user's corporate_id
    # Book-for-others
    booked_for_other: Optional[bool] = False
    guest_contact_name: Optional[str] = None
    guest_contact_phone: Optional[str] = None
    guest_vehicle: Optional[dict] = None        # {plate, make, model, year} — not saved to booker's vehicle list


class ProductUsed(BaseModel):
    product_id: str
    product_name: str
    brand: Optional[str] = ""
    unit: str = "pcs"
    quantity: float = 1
    unit_price: float = 0.0  # price at time of use


class ServiceReport(BaseModel):
    service_id: str
    service_name: str
    work_done: str
    next_service_months: Optional[int] = None
    media: Optional[List[str]] = None  # list of /uploads/... URLs
    products_used: Optional[List[ProductUsed]] = None


class BookingStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(confirmed|rejected|in_progress|completed|cancelled)$")
    note: Optional[str] = None
    completion_notes: Optional[str] = None   # general/overall notes
    next_service_months: Optional[int] = None
    service_reports: Optional[List[ServiceReport]] = None


class BookingReschedule(BaseModel):
    scheduled_date: str  # ISO date string YYYY-MM-DD
    scheduled_time: str  # HH:MM

class BookingStationAssign(BaseModel):
    station_id: Optional[str] = None  # None = unassign


class BookingMechanicAssign(BaseModel):
    mechanic_id: Optional[str] = None  # None = unassign


class InsuranceClaimSubmit(BaseModel):
    provider: str
    policy_number: str
    incident_date: str
    claim_number: Optional[str] = ""


class InsuranceClaimStatusUpdate(BaseModel):
    claim_status: str  # "submitted" | "processing" | "approved" | "rejected"
    claim_note: Optional[str] = None


class BookingResponse(BaseModel):
    id: str
    customer_id: str
    customer_name: str
    customer_phone: str
    workshop_id: str
    workshop_name: str
    workshop_address: str
    services: List[dict]
    vehicle_plate: str
    vehicle_name: str
    vehicle_brand: str
    scheduled_date: str
    scheduled_time: str
    notes: Optional[str] = ""
    status: str  # pending, confirmed, rejected, in_progress, completed, cancelled
    total_price: float
    payment_status: str  # unpaid, paid
    payment_intent_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
