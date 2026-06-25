from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class MessageSend(BaseModel):
    booking_id: str
    content: str


class MessageResponse(BaseModel):
    id: str
    booking_id: str
    sender_id: str
    sender_name: str
    sender_role: str
    content: str
    created_at: datetime
    is_read: bool = False
