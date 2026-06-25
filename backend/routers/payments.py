from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime
from core.database import get_db
from core.config import settings
from middleware.auth import require_customer

router = APIRouter(prefix="/payments", tags=["payments"])

try:
    import stripe
    stripe.api_key = settings.stripe_secret_key
    STRIPE_AVAILABLE = True
except Exception:
    STRIPE_AVAILABLE = False


@router.post("/create-intent/{booking_id}")
async def create_payment_intent(booking_id: str, user=Depends(require_customer), db=Depends(get_db)):
    booking = await db.bookings.find_one({"_id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking["customer_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if booking["status"] not in ("confirmed", "completed"):
        raise HTTPException(status_code=400, detail="Booking must be confirmed or completed before payment")
    if booking["payment_status"] == "paid":
        raise HTTPException(status_code=400, detail="Already paid")

    if not STRIPE_AVAILABLE or settings.stripe_secret_key == "sk_test_placeholder":
        mock_intent_id = f"pi_mock_{booking_id}"
        await db.bookings.update_one(
            {"_id": booking_id},
            {"$set": {"payment_intent_id": mock_intent_id, "updated_at": datetime.utcnow()}},
        )
        return {
            "client_secret": f"{mock_intent_id}_secret_mock",
            "amount": booking["total_price"],
            "currency": "myr",
            "mock": True,
        }

    intent = stripe.PaymentIntent.create(
        amount=int(booking["total_price"] * 100),
        currency="myr",
        metadata={"booking_id": booking_id, "customer_id": user["_id"]},
        payment_method_types=["card"],
    )
    await db.bookings.update_one(
        {"_id": booking_id},
        {"$set": {"payment_intent_id": intent.id, "updated_at": datetime.utcnow()}},
    )
    return {
        "client_secret": intent.client_secret,
        "amount": booking["total_price"],
        "currency": "myr",
        "mock": False,
    }


@router.post("/confirm/{booking_id}")
async def confirm_payment(booking_id: str, user=Depends(require_customer), db=Depends(get_db)):
    booking = await db.bookings.find_one({"_id": booking_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking["customer_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    await db.bookings.update_one(
        {"_id": booking_id},
        {"$set": {"payment_status": "paid", "updated_at": datetime.utcnow()}},
    )
    return {"message": "Payment confirmed", "payment_status": "paid"}


@router.post("/webhook")
async def stripe_webhook(request: Request, db=Depends(get_db)):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    if not STRIPE_AVAILABLE:
        return {"received": True}

    try:
        event = stripe.Webhook.construct_event(payload, sig, settings.stripe_webhook_secret)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid webhook")

    if event["type"] == "payment_intent.succeeded":
        pi = event["data"]["object"]
        booking_id = pi["metadata"].get("booking_id")
        if booking_id:
            await db.bookings.update_one(
                {"_id": booking_id},
                {"$set": {"payment_status": "paid", "updated_at": datetime.utcnow()}},
            )

    return {"received": True}
