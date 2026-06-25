from pydantic import BaseModel
from typing import Optional


class ReferralCodeValidate(BaseModel):
    code: str


class ReferralCreditRedeem(BaseModel):
    amount: float  # amount of credits to apply; backend caps at available balance
