from motor.motor_asyncio import AsyncIOMotorClient
from .config import settings

client: AsyncIOMotorClient = None
db = None


async def connect_db():
    global client, db
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    await create_indexes()


async def close_db():
    global client
    if client:
        client.close()


async def create_indexes():
    await db.users.create_index("email", unique=True)
    await db.workshops.create_index([("location", "2dsphere")])
    await db.workshops.create_index("owner_id")
    await db.bookings.create_index("customer_id")
    await db.bookings.create_index("workshop_id")
    await db.messages.create_index("booking_id")
    await db.reviews.create_index("workshop_id")
    await db.reviews.create_index("booking_id", unique=True)


def get_db():
    return db
