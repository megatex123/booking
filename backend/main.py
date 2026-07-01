import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import socketio
from apscheduler.triggers.cron import CronTrigger

from core.database import connect_db, close_db
from core.socket_manager import sio
from routers import auth, users, workshops, bookings, chat, reviews, payments, uploads, notifications, invoices, referrals, corporate, loyalty, reminders, service_logs, schedules, queue_waitlist, admin, price_estimator

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    from core.scheduler import scheduler, check_service_reminders, check_custom_reminders
    scheduler.add_job(check_service_reminders, CronTrigger(hour=9, minute=0), id="service_reminders")
    scheduler.add_job(check_custom_reminders, CronTrigger(hour=8, minute=0), id="custom_reminders")
    scheduler.start()
    yield
    scheduler.shutdown()
    await close_db()


app = FastAPI(title="Car Service Booking API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(workshops.router, prefix="/api/v1")
app.include_router(bookings.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(reviews.router, prefix="/api/v1")
app.include_router(payments.router, prefix="/api/v1")
app.include_router(uploads.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(invoices.router, prefix="/api/v1")
app.include_router(referrals.router, prefix="/api/v1")
app.include_router(corporate.router, prefix="/api/v1")
app.include_router(loyalty.router, prefix="/api/v1")
app.include_router(reminders.router, prefix="/api/v1")
app.include_router(service_logs.router, prefix="/api/v1")
app.include_router(schedules.router, prefix="/api/v1")
app.include_router(queue_waitlist.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(price_estimator.router, prefix="/api/v1")

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/health")
async def health():
    return {"status": "ok"}


socket_app = socketio.ASGIApp(sio, other_asgi_app=app)
