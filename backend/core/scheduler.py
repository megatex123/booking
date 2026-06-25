import calendar
import logging
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from core.database import get_db
from core.notifications import push_notification

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler(timezone="UTC")


def _add_months(dt: datetime, months: int) -> datetime:
    month = dt.month - 1 + months
    year = dt.year + month // 12
    month = month % 12 + 1
    day = min(dt.day, calendar.monthrange(year, month)[1])
    return dt.replace(year=year, month=month, day=day)


async def check_service_reminders() -> int:
    """Send one in-app reminder per completed booking whose next service falls within a 7-day window."""
    db = get_db()
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    bookings = await db.bookings.find({
        "status": "completed",
        "next_service_months": {"$exists": True, "$gt": 0},
        "reminder_sent": {"$ne": True},
    }).to_list(500)

    sent = 0
    for b in bookings:
        # Fall back to updated_at for bookings created before completed_at was stored
        anchor = b.get("completed_at") or b.get("updated_at")
        if not isinstance(anchor, datetime):
            continue

        due_date = _add_months(anchor, int(b["next_service_months"]))
        days_until = (due_date.date() - today.date()).days

        # Window: 7 days before due through 7 days after (catches missed sends)
        if not (-7 <= days_until <= 7):
            continue

        vehicle = f"{b.get('vehicle_brand', '')} {b.get('vehicle_name', '')}".strip() or "Your vehicle"
        workshop = b.get("workshop_name", "the workshop")
        services = b.get("services", [])
        service_label = ", ".join(s.get("name", "") for s in services if s.get("name")) or "service"

        if days_until < 0:
            when = f"{abs(days_until)} day{'s' if abs(days_until) != 1 else ''} overdue"
        elif days_until == 0:
            when = "due today"
        else:
            when = f"due in {days_until} day{'s' if days_until != 1 else ''}"

        await push_notification(
            db,
            b["customer_id"],
            "service_reminder",
            f"Service Due — {vehicle}",
            f"Your {service_label} at {workshop} is {when}. Book now to keep your car in top shape!",
            {
                "booking_id": b["_id"],
                "workshop_id": b.get("workshop_id", ""),
                "workshop_name": workshop,
                "vehicle": vehicle,
                "due_date": due_date.date().isoformat(),
            },
        )

        await db.bookings.update_one(
            {"_id": b["_id"]},
            {"$set": {"reminder_sent": True, "reminder_sent_at": datetime.utcnow()}},
        )
        sent += 1
        logger.info(f"[reminders] booking={b['_id']} vehicle={vehicle!r} {when}")

    logger.info(f"[reminders] complete — {sent} sent")
    return sent
