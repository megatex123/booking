from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ReviewCreate(BaseModel):
    booking_id: str
    rating: float = Field(..., ge=1, le=5)
    comment: Optional[str] = ""


class ReviewResponse(BaseModel):
    id: str
    booking_id: str
    workshop_id: str
    customer_id: str
    customer_name: str
    rating: float
    comment: Optional[str] = ""
    created_at: datetime
