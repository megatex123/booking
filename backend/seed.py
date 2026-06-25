"""
Run: /var/data/python/bin/python seed.py
Seeds the database with dummy workshops, customers, bookings, and reviews.
"""
import asyncio
from datetime import datetime, timedelta
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt

MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "carbooking"


def oid() -> str:
    return str(ObjectId())


def hashed(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


NOW = datetime.utcnow()


def working_hours(closed_days=("sunday",)):
    return {
        day: {"open": "08:00", "close": "18:00", "is_open": day not in closed_days}
        for day in ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    }


def working_hours_24_6(closed_days=("sunday",)):
    return {
        day: {"open": "07:00", "close": "21:00", "is_open": day not in closed_days}
        for day in ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    }


def svc(name, desc, price, mins, cat):
    return {
        "_id": oid(), "name": name, "description": desc,
        "price": price, "duration_minutes": mins,
        "category": cat, "is_active": True, "created_at": NOW,
    }


def prod(name, brand, cat, price, qty, unit, desc="", tags=None):
    return {
        "_id": oid(), "name": name, "brand": brand,
        "category": cat, "price": price, "quantity": float(qty),
        "unit": unit, "description": desc,
        "service_tags": tags or [], "created_at": NOW,
    }


async def seed():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    for col in ["users", "workshops", "bookings", "messages", "reviews", "notifications"]:
        await db[col].drop()
    print("✓ Cleared existing collections")

    # ── Customers ─────────────────────────────────────────────────────────────
    customers = [
        {
            "_id": oid(), "name": "Ahmad Rizal", "email": "ahmad@example.com",
            "password": hashed("password123"), "phone": "+60123456789",
            "role": "customer", "vehicles": [
                {"name": "Myvi", "plate": "WXY 1234", "brand": "Perodua", "year": 2020, "color": "Silver"},
                {"name": "Viva", "plate": "ABC 5678", "brand": "Perodua", "year": 2018, "color": "Red"},
            ],
            "avatar": None, "created_at": NOW, "updated_at": NOW,
        },
        {
            "_id": oid(), "name": "Siti Nuraini", "email": "siti@example.com",
            "password": hashed("password123"), "phone": "+60198765432",
            "role": "customer", "vehicles": [
                {"name": "Persona", "plate": "PQR 9012", "brand": "Proton", "year": 2022, "color": "White"},
            ],
            "avatar": None, "created_at": NOW, "updated_at": NOW,
        },
        {
            "_id": oid(), "name": "Rajan Kumar", "email": "rajan@example.com",
            "password": hashed("password123"), "phone": "+60112223344",
            "role": "customer", "vehicles": [
                {"name": "Civic", "plate": "VJK 3344", "brand": "Honda", "year": 2021, "color": "Black"},
            ],
            "avatar": None, "created_at": NOW, "updated_at": NOW,
        },
        {
            "_id": oid(), "name": "Lee Wei Liang", "email": "wei@example.com",
            "password": hashed("password123"), "phone": "+60133445566",
            "role": "customer", "vehicles": [
                {"name": "Almera", "plate": "BDC 7788", "brand": "Nissan", "year": 2019, "color": "Silver"},
                {"name": "X-Trail", "plate": "WGH 5500", "brand": "Nissan", "year": 2023, "color": "White"},
            ],
            "avatar": None, "created_at": NOW, "updated_at": NOW,
        },
    ]
    await db.users.insert_many(customers)
    print(f"✓ Created {len(customers)} customers")

    # ── Workshop owners ────────────────────────────────────────────────────────
    owner_ids = {k: oid() for k in [
        "hafiz", "ken", "razif",
        "azman", "gear",
        "powertech", "diagnostix",
        "clearvision", "luxe",
        "speedwheel", "rimcraft",
        "stopright", "suspro",
        "quicklube", "autocare",
        "turboking", "greendrive",
        "soundbox", "tintpro",
        "gleam", "pureshine",
    ]}

    owners = [
        {"_id": owner_ids["hafiz"],     "name": "Hafiz Workshop",          "email": "hafiz@workshop.com",      "password": hashed("password123"), "phone": "+60112345678", "role": "workshop", "avatar": None, "created_at": NOW, "updated_at": NOW},
        {"_id": owner_ids["ken"],       "name": "Ken Auto Care",            "email": "ken@workshop.com",        "password": hashed("password123"), "phone": "+60167654321", "role": "workshop", "avatar": None, "created_at": NOW, "updated_at": NOW},
        {"_id": owner_ids["razif"],     "name": "Razif Motors",             "email": "razif@workshop.com",      "password": hashed("password123"), "phone": "+60134455667", "role": "workshop", "avatar": None, "created_at": NOW, "updated_at": NOW},
        {"_id": owner_ids["azman"],     "name": "Azman Engines",            "email": "azman@workshop.com",      "password": hashed("password123"), "phone": "+60111122334", "role": "workshop", "avatar": None, "created_at": NOW, "updated_at": NOW},
        {"_id": owner_ids["gear"],      "name": "Gear & Drive Works",       "email": "gear@workshop.com",       "password": hashed("password123"), "phone": "+60122233445", "role": "workshop", "avatar": None, "created_at": NOW, "updated_at": NOW},
        {"_id": owner_ids["powertech"], "name": "PowerTech Auto",           "email": "powertech@workshop.com",  "password": hashed("password123"), "phone": "+60133344556", "role": "workshop", "avatar": None, "created_at": NOW, "updated_at": NOW},
        {"_id": owner_ids["diagnostix"],"name": "DiagnostixPro",            "email": "diagnostix@workshop.com", "password": hashed("password123"), "phone": "+60144455667", "role": "workshop", "avatar": None, "created_at": NOW, "updated_at": NOW},
        {"_id": owner_ids["clearvision"],"name": "ClearVision Glass",       "email": "clearvision@workshop.com","password": hashed("password123"), "phone": "+60155566778", "role": "workshop", "avatar": None, "created_at": NOW, "updated_at": NOW},
        {"_id": owner_ids["luxe"],      "name": "Luxe Panel & Paint",       "email": "luxe@workshop.com",       "password": hashed("password123"), "phone": "+60166677889", "role": "workshop", "avatar": None, "created_at": NOW, "updated_at": NOW},
        {"_id": owner_ids["speedwheel"],"name": "SpeedWheel Tyres",         "email": "speedwheel@workshop.com", "password": hashed("password123"), "phone": "+60177788990", "role": "workshop", "avatar": None, "created_at": NOW, "updated_at": NOW},
        {"_id": owner_ids["rimcraft"],  "name": "RimCraft Wheel Works",     "email": "rimcraft@workshop.com",   "password": hashed("password123"), "phone": "+60188899001", "role": "workshop", "avatar": None, "created_at": NOW, "updated_at": NOW},
        {"_id": owner_ids["stopright"], "name": "StopRight Brake Centre",   "email": "stopright@workshop.com",  "password": hashed("password123"), "phone": "+60199900112", "role": "workshop", "avatar": None, "created_at": NOW, "updated_at": NOW},
        {"_id": owner_ids["suspro"],    "name": "SuspensionPro MY",         "email": "suspro@workshop.com",     "password": hashed("password123"), "phone": "+60110011223", "role": "workshop", "avatar": None, "created_at": NOW, "updated_at": NOW},
        {"_id": owner_ids["quicklube"], "name": "QuickLube Express",        "email": "quicklube@workshop.com",  "password": hashed("password123"), "phone": "+60121122334", "role": "workshop", "avatar": None, "created_at": NOW, "updated_at": NOW},
        {"_id": owner_ids["autocare"],  "name": "AutoCare Services",        "email": "autocare@workshop.com",   "password": hashed("password123"), "phone": "+60132233445", "role": "workshop", "avatar": None, "created_at": NOW, "updated_at": NOW},
        {"_id": owner_ids["turboking"], "name": "TurboKing Performance",    "email": "turboking@workshop.com",  "password": hashed("password123"), "phone": "+60143344556", "role": "workshop", "avatar": None, "created_at": NOW, "updated_at": NOW},
        {"_id": owner_ids["greendrive"],"name": "GreenDrive EV & Hybrid",   "email": "greendrive@workshop.com", "password": hashed("password123"), "phone": "+60154455667", "role": "workshop", "avatar": None, "created_at": NOW, "updated_at": NOW},
        {"_id": owner_ids["soundbox"],  "name": "SoundBox Car Audio",       "email": "soundbox@workshop.com",   "password": hashed("password123"), "phone": "+60165566778", "role": "workshop", "avatar": None, "created_at": NOW, "updated_at": NOW},
        {"_id": owner_ids["tintpro"],   "name": "TintPro & Wraps",          "email": "tintpro@workshop.com",    "password": hashed("password123"), "phone": "+60176677889", "role": "workshop", "avatar": None, "created_at": NOW, "updated_at": NOW},
        {"_id": owner_ids["gleam"],     "name": "Gleam Pro Detailing",      "email": "gleam@workshop.com",      "password": hashed("password123"), "phone": "+60187788990", "role": "workshop", "avatar": None, "created_at": NOW, "updated_at": NOW},
        {"_id": owner_ids["pureshine"], "name": "PureShine Auto Spa",       "email": "pureshine@workshop.com",  "password": hashed("password123"), "phone": "+60198899001", "role": "workshop", "avatar": None, "created_at": NOW, "updated_at": NOW},
    ]
    await db.users.insert_many(owners)
    print(f"✓ Created {len(owners)} workshop owners")

    # ── Workshops ─────────────────────────────────────────────────────────────
    w_ids = {k: oid() for k in owner_ids}

    workshops = [

        # ── MAINTENANCE & SERVICING ────────────────────────────────────────────
        {
            "_id": w_ids["hafiz"], "owner_id": owner_ids["hafiz"],
            "workshop_name": "Hafiz Auto Workshop",
            "description": "Trusted workshop in Kuala Lumpur since 2010. Specializing in engine overhaul and oil changes for all car brands.",
            "address": "No 12, Jalan Ampang, 50450 Kuala Lumpur",
            "phone": "+60112345678",
            "location": {"type": "Point", "coordinates": [101.7069, 3.1590]},
            "latitude": 3.1590, "longitude": 101.7069,
            "rating": 4.7, "total_reviews": 4, "is_open": True,
            "working_hours": working_hours(["sunday"]), "images": [],
            "services": [
                svc("Engine Oil Change", "Full synthetic oil change with filter replacement", 80.0, 45, "oil_change"),
                svc("Brake Pad Replacement", "Front or rear brake pad replacement with inspection", 220.0, 90, "brake"),
                svc("Tyre Rotation & Balancing", "Rotate and balance all 4 tyres for even wear", 60.0, 60, "tire"),
                svc("Engine Tune-Up", "Spark plug, air filter, and fuel system cleaning", 350.0, 120, "engine"),
                svc("Air-Con Service", "Gas refill, cleaning and leak check", 150.0, 60, "electrical"),
                svc("Scheduled 10,000km Service", "Oil, filter, fluid top-ups, 30-point inspection", 250.0, 120, "oil_change"),
            ],
            "products": [
                prod("Castrol GTX 5W-30 Engine Oil", "Castrol", "lubricant", 28.0, 50, "litre", "Full synthetic, 1L", ["Engine Oil Change", "Engine Tune-Up", "Scheduled 10,000km Service"]),
                prod("Mobil 1 5W-40 Engine Oil", "Mobil", "lubricant", 35.0, 30, "litre", "Full synthetic high-perf, 1L", ["Engine Oil Change"]),
                prod("Proton/Perodua OEM Oil Filter", "Bosch", "filter", 15.0, 20, "pcs", "Fits most Proton & Perodua", ["Engine Oil Change", "Engine Tune-Up", "Scheduled 10,000km Service"]),
                prod("Air Filter — Universal", "K&N", "filter", 45.0, 10, "pcs", "High-flow washable air filter", ["Engine Tune-Up"]),
                prod("Iridium Spark Plug", "NGK", "filter", 22.0, 40, "pcs", "Long-life, per piece", ["Engine Tune-Up"]),
                prod("TRW Brake Pad Set (Front)", "TRW", "brake", 85.0, 15, "set", "OEM-quality front set", ["Brake Pad Replacement"]),
                prod("Brembo Brake Pad Set (Front)", "Brembo", "brake", 145.0, 8, "set", "Performance front set", ["Brake Pad Replacement"]),
                prod("Brake Fluid DOT 4", "Bosch", "brake", 18.0, 20, "litre", "500ml", ["Brake Pad Replacement"]),
                prod("R134a Refrigerant Gas", "Chemours", "electrical", 55.0, 12, "pcs", "AC refill canister", ["Air-Con Service"]),
                prod("AC Cabin Filter", "Denso", "filter", 35.0, 15, "pcs", "Activated carbon cabin filter", ["Air-Con Service"]),
            ],
            "created_at": NOW, "updated_at": NOW,
        },

        {
            "_id": w_ids["ken"], "owner_id": owner_ids["ken"],
            "workshop_name": "Ken Auto Care Centre",
            "description": "Modern workshop with computerized diagnostics. We handle everything from tyres to full engine rebuilds.",
            "address": "Lot 5, Jalan PJU 1A/3, 47301 Petaling Jaya, Selangor",
            "phone": "+60167654321",
            "location": {"type": "Point", "coordinates": [101.6119, 3.1073]},
            "latitude": 3.1073, "longitude": 101.6119,
            "rating": 4.4, "total_reviews": 3, "is_open": True,
            "working_hours": working_hours(["sunday"]), "images": [],
            "services": [
                svc("Full Car Service", "Comprehensive 50-point vehicle inspection and service", 450.0, 180, "engine"),
                svc("Tyre Replacement (per tyre)", "Supply and fit new tyre, includes balancing", 180.0, 30, "tire"),
                svc("Wheel Alignment", "4-wheel computerized alignment", 80.0, 45, "tire"),
                svc("Battery Replacement", "Test and replace car battery with warranty", 200.0, 30, "electrical"),
                svc("Windscreen Replacement", "OEM quality windscreen supply and install", 600.0, 120, "body"),
                svc("Engine Oil Change", "Semi-synthetic oil change with OEM filter", 65.0, 30, "oil_change"),
            ],
            "products": [
                prod("Shell Helix HX7 10W-40", "Shell", "lubricant", 26.0, 60, "litre", "Semi-synthetic, 1L", ["Full Car Service", "Engine Oil Change"]),
                prod("Castrol EDGE 0W-20", "Castrol", "lubricant", 42.0, 24, "litre", "Full synthetic turbo, 1L", ["Engine Oil Change", "Full Car Service"]),
                prod("Denso Oil Filter", "Denso", "filter", 12.0, 30, "pcs", "OEM-spec", ["Engine Oil Change", "Full Car Service"]),
                prod("Michelin Pilot Sport 4 (195/65 R15)", "Michelin", "tyre", 320.0, 8, "pcs", "High-perf all-season", ["Tyre Replacement (per tyre)"]),
                prod("Bridgestone Ecopia EP300 (185/60 R15)", "Bridgestone", "tyre", 260.0, 12, "pcs", "Fuel-efficient", ["Tyre Replacement (per tyre)"]),
                prod("Amaron Hi-Life 55B24LS Battery", "Amaron", "electrical", 185.0, 6, "pcs", "Maintenance-free, 18-month warranty", ["Battery Replacement"]),
                prod("Varta Silver Dynamic 60Ah", "Varta", "electrical", 220.0, 4, "pcs", "Premium, 24-month warranty", ["Battery Replacement"]),
                prod("Transmission Fluid ATF", "Valvoline", "lubricant", 32.0, 10, "litre", "Auto transmission fluid, 1L", ["Full Car Service"]),
                prod("Coolant (Premixed)", "Prestone", "other", 22.0, 15, "litre", "50/50 premixed, 1L", ["Full Car Service"]),
            ],
            "created_at": NOW, "updated_at": NOW,
        },

        {
            "_id": w_ids["quicklube"], "owner_id": owner_ids["quicklube"],
            "workshop_name": "QuickLube Express Service",
            "description": "Fast, no-appointment oil change and maintenance service. In and out in 30 minutes guaranteed.",
            "address": "B-1, Solaris Mont Kiara, 50480 Kuala Lumpur",
            "phone": "+60121122334",
            "location": {"type": "Point", "coordinates": [101.6530, 3.1684]},
            "latitude": 3.1684, "longitude": 101.6530,
            "rating": 4.5, "total_reviews": 3, "is_open": True,
            "working_hours": working_hours_24_6(["sunday"]), "images": [],
            "services": [
                svc("Express Oil Change (30 min)", "Quick synthetic oil change, no appointment needed", 70.0, 30, "oil_change"),
                svc("Scheduled 5,000km Service", "Oil, filter, fluid check, tyre pressure", 120.0, 45, "oil_change"),
                svc("Scheduled 20,000km Service", "Full fluids, filters, belts, and inspection", 380.0, 150, "engine"),
                svc("Vehicle Inspection & Report", "35-point inspection with written report", 80.0, 60, "other"),
                svc("Coolant Flush & Refill", "Drain, flush, and refill coolant system", 120.0, 45, "engine"),
            ],
            "products": [
                prod("Petronas Syntium 800 10W-40", "Petronas", "lubricant", 24.0, 80, "litre", "Semi-synthetic, 1L", ["Express Oil Change (30 min)", "Scheduled 5,000km Service"]),
                prod("Castrol Magnatec 5W-30", "Castrol", "lubricant", 32.0, 50, "litre", "Full synthetic, 1L", ["Express Oil Change (30 min)", "Scheduled 20,000km Service"]),
                prod("Honda/Toyota OEM Oil Filter", "OEM", "filter", 14.0, 40, "pcs", "Fits Honda & Toyota models", ["Express Oil Change (30 min)", "Scheduled 5,000km Service", "Scheduled 20,000km Service"]),
                prod("Prestone Coolant Green", "Prestone", "other", 20.0, 20, "litre", "Premixed, 1L", ["Coolant Flush & Refill"]),
                prod("Windshield Washer Fluid", "Rain-X", "other", 12.0, 30, "litre", "All-season, 1L", ["Scheduled 5,000km Service"]),
            ],
            "created_at": NOW, "updated_at": NOW,
        },

        {
            "_id": w_ids["autocare"], "owner_id": owner_ids["autocare"],
            "workshop_name": "AutoCare Preventive Services",
            "description": "Scheduled maintenance and full vehicle inspection specialists. We keep your car in factory condition.",
            "address": "No 7, Jalan Wangsa Setia 1, 53300 Wangsa Maju, KL",
            "phone": "+60132233445",
            "location": {"type": "Point", "coordinates": [101.7370, 3.1920]},
            "latitude": 3.1920, "longitude": 101.7370,
            "rating": 4.3, "total_reviews": 2, "is_open": True,
            "working_hours": working_hours(["sunday"]), "images": [],
            "services": [
                svc("Engine Oil Change", "Synthetic oil change with multi-point check", 75.0, 40, "oil_change"),
                svc("Preventive Maintenance Package", "Oil, belts, hoses, fluids and 40-point inspection", 420.0, 180, "engine"),
                svc("Pre-Purchase Inspection", "Thorough check for used car buyers, full report provided", 150.0, 90, "other"),
                svc("Timing Belt Replacement", "OEM timing belt replacement with tensioner", 550.0, 180, "mechanical"),
                svc("Fuel System Cleaning", "Fuel injector and throttle body cleaning", 180.0, 60, "engine"),
            ],
            "products": [
                prod("Mobil Super 3000 5W-40", "Mobil", "lubricant", 30.0, 40, "litre", "Full synthetic, 1L", ["Engine Oil Change", "Preventive Maintenance Package"]),
                prod("OEM Timing Belt Kit", "Gates", "mechanical", 180.0, 10, "set", "Belt + tensioner + idler", ["Timing Belt Replacement"]),
                prod("Oil Filter — Proton/Perodua", "Champion", "filter", 12.0, 30, "pcs", "OEM-compatible", ["Engine Oil Change"]),
                prod("BG Fuel System Cleaner", "BG", "other", 85.0, 15, "pcs", "Professional fuel injector cleaner", ["Fuel System Cleaning"]),
                prod("Gates Serpentine Belt", "Gates", "mechanical", 65.0, 12, "pcs", "Accessory drive belt", ["Preventive Maintenance Package"]),
            ],
            "created_at": NOW, "updated_at": NOW,
        },

        # ── MECHANICAL & DRIVETRAIN ────────────────────────────────────────────
        {
            "_id": w_ids["azman"], "owner_id": owner_ids["azman"],
            "workshop_name": "Azman Engine Specialist",
            "description": "Over 20 years of engine repair and rebuilding experience. We handle engine overhaul, rebuilding, and general mechanical work for all brands.",
            "address": "No 33, Jalan Puchong Utama 6, 47100 Puchong, Selangor",
            "phone": "+60111122334",
            "location": {"type": "Point", "coordinates": [101.6245, 2.9955]},
            "latitude": 2.9955, "longitude": 101.6245,
            "rating": 4.6, "total_reviews": 3, "is_open": True,
            "working_hours": working_hours(["sunday"]), "images": [],
            "services": [
                svc("Engine Overhaul (Partial)", "Top-end overhaul: head gasket, valves, seals", 1800.0, 480, "mechanical"),
                svc("Engine Full Rebuild", "Complete strip-down and rebuild with new internals", 4500.0, 1440, "mechanical"),
                svc("General Mechanical Repair", "Diagnosis and repair of mechanical faults", 200.0, 120, "mechanical"),
                svc("Engine Diagnostic Scan", "OBD scan + physical inspection + repair report", 80.0, 60, "mechanical"),
                svc("Clutch Replacement", "Full clutch kit replacement with flywheel check", 650.0, 240, "mechanical"),
            ],
            "products": [
                prod("Head Gasket Set — Proton/Perodua", "Fel-Pro", "mechanical", 220.0, 8, "set", "Full head gasket set with bolts", ["Engine Overhaul (Partial)"]),
                prod("Piston Ring Set", "Mahle", "mechanical", 180.0, 6, "set", "Standard size piston ring set", ["Engine Full Rebuild"]),
                prod("Engine Bearing Set", "King", "mechanical", 95.0, 10, "set", "Main and con-rod bearings", ["Engine Full Rebuild"]),
                prod("Valve Stem Seal Set", "Victor Reinz", "mechanical", 65.0, 12, "set", "Full valve stem seal set", ["Engine Overhaul (Partial)"]),
                prod("Sachs Clutch Kit", "Sachs", "mechanical", 380.0, 5, "set", "Disc + pressure plate + release bearing", ["Clutch Replacement"]),
                prod("LUK Clutch Kit", "LUK", "mechanical", 420.0, 4, "set", "OEM-grade clutch kit", ["Clutch Replacement"]),
                prod("Engine Assembly Lube", "Permatex", "lubricant", 28.0, 15, "pcs", "Engine assembly lube, 4oz", ["Engine Full Rebuild", "Engine Overhaul (Partial)"]),
            ],
            "created_at": NOW, "updated_at": NOW,
        },

        {
            "_id": w_ids["gear"], "owner_id": owner_ids["gear"],
            "workshop_name": "Gear & Drive Transmission Centre",
            "description": "Transmission, gearbox, clutch and differential specialists. Both manual and automatic gearboxes.",
            "address": "Lot 12, Jalan Utas 15/7, 40200 Shah Alam, Selangor",
            "phone": "+60122233445",
            "location": {"type": "Point", "coordinates": [101.5320, 3.0850]},
            "latitude": 3.0850, "longitude": 101.5320,
            "rating": 4.5, "total_reviews": 3, "is_open": True,
            "working_hours": working_hours(["sunday"]), "images": [],
            "services": [
                svc("Auto Transmission Service", "ATF drain, refill, filter clean and adjustment", 280.0, 90, "mechanical"),
                svc("Auto Transmission Rebuild", "Full automatic gearbox strip-down and rebuild", 3200.0, 1440, "mechanical"),
                svc("Manual Gearbox Repair", "Diagnose and repair manual gearbox fault", 800.0, 360, "mechanical"),
                svc("Differential Service", "Diff oil change and inspection", 180.0, 60, "mechanical"),
                svc("Differential Rebuild", "Full differential rebuild with new bearings and seals", 1200.0, 480, "mechanical"),
                svc("CV Joint & Driveshaft Replacement", "Replace CV boot, joint, or full driveshaft", 350.0, 120, "mechanical"),
            ],
            "products": [
                prod("Aisin ATF D-III", "Aisin", "lubricant", 30.0, 30, "litre", "OEM spec ATF, 1L", ["Auto Transmission Service"]),
                prod("Valvoline MaxLife ATF", "Valvoline", "lubricant", 38.0, 20, "litre", "Multi-vehicle ATF, 1L", ["Auto Transmission Service", "Auto Transmission Rebuild"]),
                prod("Gear Oil 75W-90 GL-5", "Motul", "lubricant", 35.0, 20, "litre", "Manual gearbox oil, 1L", ["Manual Gearbox Repair", "Differential Service"]),
                prod("Transmission Filter Kit", "OEM", "filter", 65.0, 10, "set", "ATF filter + gasket set", ["Auto Transmission Service", "Auto Transmission Rebuild"]),
                prod("GKN CV Joint (inner)", "GKN", "mechanical", 180.0, 8, "pcs", "Inner CV joint, universal fit", ["CV Joint & Driveshaft Replacement"]),
                prod("CV Boot Kit", "Firstline", "mechanical", 45.0, 15, "set", "CV boot + clamps + grease", ["CV Joint & Driveshaft Replacement"]),
                prod("Differential Bearing Set", "SKF", "mechanical", 120.0, 6, "set", "Differential bearing and seal kit", ["Differential Rebuild"]),
            ],
            "created_at": NOW, "updated_at": NOW,
        },

        # ── ELECTRICAL & ELECTRONICS ───────────────────────────────────────────
        {
            "_id": w_ids["powertech"], "owner_id": owner_ids["powertech"],
            "workshop_name": "PowerTech Auto Electrical",
            "description": "Auto electrical specialists: wiring, batteries, alternators, starters and all 12V systems.",
            "address": "No 4, Jalan Kepong Baru, 52100 Kepong, Kuala Lumpur",
            "phone": "+60133344556",
            "location": {"type": "Point", "coordinates": [101.6370, 3.2010]},
            "latitude": 3.2010, "longitude": 101.6370,
            "rating": 4.4, "total_reviews": 2, "is_open": True,
            "working_hours": working_hours(["sunday"]), "images": [],
            "services": [
                svc("Battery Replacement & Test", "Load test, replace and register new battery", 190.0, 30, "electrical"),
                svc("Alternator Repair / Replacement", "Test, rebuild or replace alternator", 350.0, 120, "electrical"),
                svc("Starter Motor Repair", "Test, repair or replace starter motor", 280.0, 90, "electrical"),
                svc("Auto Electrical Diagnosis", "Full vehicle wiring and electrical fault diagnosis", 100.0, 60, "electrical"),
                svc("Wiring Harness Repair", "Trace and repair wiring faults, replace damaged harness sections", 250.0, 120, "electrical"),
                svc("Car Lighting Upgrade", "LED headlight, DRL, or interior lighting upgrade", 180.0, 60, "electrical"),
            ],
            "products": [
                prod("Amaron Silver 65B24L Battery", "Amaron", "electrical", 195.0, 10, "pcs", "60Ah, maintenance-free, 18-month", ["Battery Replacement & Test"]),
                prod("Optima Red Top 34 Battery", "Optima", "electrical", 450.0, 4, "pcs", "High-CCA AGM battery", ["Battery Replacement & Test"]),
                prod("Bosch S5 Battery 60Ah", "Bosch", "electrical", 280.0, 6, "pcs", "European-standard, 24-month", ["Battery Replacement & Test"]),
                prod("Denso Remanufactured Alternator", "Denso", "electrical", 320.0, 4, "pcs", "Remanufactured OEM alternator", ["Alternator Repair / Replacement"]),
                prod("Valeo Starter Motor", "Valeo", "electrical", 280.0, 4, "pcs", "Remanufactured starter motor", ["Starter Motor Repair"]),
                prod("Philips LED Headlight H4", "Philips", "electrical", 120.0, 10, "pcs", "6000K LED replacement pair", ["Car Lighting Upgrade"]),
                prod("Wire Harness Tape (self-amalgamating)", "Tesa", "electrical", 15.0, 30, "pcs", "Self-amalgamating insulation tape", ["Wiring Harness Repair"]),
            ],
            "created_at": NOW, "updated_at": NOW,
        },

        {
            "_id": w_ids["diagnostix"], "owner_id": owner_ids["diagnostix"],
            "workshop_name": "DiagnostixPro ECU & AC Centre",
            "description": "ECU diagnostics, computer tuning, and automotive air conditioning specialists.",
            "address": "No 22, Jalan SS15/4A, 47500 Subang Jaya, Selangor",
            "phone": "+60144455667",
            "location": {"type": "Point", "coordinates": [101.5900, 3.0740]},
            "latitude": 3.0740, "longitude": 101.5900,
            "rating": 4.7, "total_reviews": 3, "is_open": True,
            "working_hours": working_hours(["sunday"]), "images": [],
            "services": [
                svc("ECU Diagnostic Scan (OBD II)", "Full scan with fault code report and reset", 80.0, 45, "electrical"),
                svc("ECU Remapping / Tuning", "Custom ECU tune for performance or fuel economy", 650.0, 180, "electrical"),
                svc("A/C Full Service", "Leak test, vacuum, regas and performance check", 180.0, 90, "electrical"),
                svc("A/C Compressor Replacement", "Supply and fit new or remanufactured compressor", 850.0, 180, "electrical"),
                svc("A/C Evaporator Cleaning", "Remove and clean evaporator coil, eliminate odour", 220.0, 120, "electrical"),
                svc("Engine Management Light Reset", "Diagnose and clear engine warning lights", 100.0, 45, "electrical"),
            ],
            "products": [
                prod("R134a Refrigerant 500g", "Chemours", "electrical", 65.0, 20, "pcs", "AC refrigerant canister", ["A/C Full Service", "A/C Compressor Replacement"]),
                prod("Sanden SD7H15 Compressor", "Sanden", "electrical", 650.0, 3, "pcs", "Universal AC compressor", ["A/C Compressor Replacement"]),
                prod("Denso Remanufactured Compressor", "Denso", "electrical", 580.0, 3, "pcs", "OEM-spec remanufactured", ["A/C Compressor Replacement"]),
                prod("PAG 46 Compressor Oil", "Fuchs", "electrical", 35.0, 12, "litre", "PAG oil for R134a systems, 250ml", ["A/C Full Service"]),
                prod("AC Evaporator Cleaner Spray", "3M", "electrical", 45.0, 20, "pcs", "Foam cleaner for evaporator coils", ["A/C Evaporator Cleaning"]),
                prod("AC Cabin Filter — Carbon", "Mann", "filter", 40.0, 15, "pcs", "Activated carbon cabin filter", ["A/C Full Service", "A/C Evaporator Cleaning"]),
            ],
            "created_at": NOW, "updated_at": NOW,
        },

        # ── BODY & EXTERIOR ───────────────────────────────────────────────────
        {
            "_id": w_ids["razif"], "owner_id": owner_ids["razif"],
            "workshop_name": "Razif Motors & Body Works",
            "description": "Specializing in body repair, spray painting, and panel beating. Insurance claims accepted.",
            "address": "No 88, Jalan Cheras, 56000 Kuala Lumpur",
            "phone": "+60134455667",
            "location": {"type": "Point", "coordinates": [101.7270, 3.1002]},
            "latitude": 3.1002, "longitude": 101.7270,
            "rating": 4.2, "total_reviews": 2, "is_open": False,
            "working_hours": working_hours(["saturday", "sunday"]), "images": [],
            "services": [
                svc("Dent Removal (small)", "PDR dent removal for small dents without repainting", 120.0, 60, "body"),
                svc("Full Body Respray", "Complete vehicle respray with premium paint", 3500.0, 2880, "body"),
                svc("Bumper Repair & Paint", "Repair and repaint front or rear bumper", 280.0, 180, "body"),
                svc("Panel Beating", "Straighten and repair damaged body panels", 350.0, 240, "body"),
                svc("Engine Oil Change", "Conventional oil change with filter", 55.0, 30, "oil_change"),
            ],
            "products": [
                prod("Nippon Paint 1K Basecoat — Silver", "Nippon Paint", "body", 65.0, 20, "litre", "1K basecoat silver, 1L", ["Full Body Respray", "Bumper Repair & Paint"]),
                prod("Nippon Paint 1K Basecoat — White", "Nippon Paint", "body", 62.0, 20, "litre", "1K basecoat white, 1L", ["Full Body Respray", "Bumper Repair & Paint"]),
                prod("Sikkens Autoclear LV Clearcoat", "Sikkens", "body", 95.0, 10, "litre", "Premium clearcoat, 1L", ["Full Body Respray", "Bumper Repair & Paint"]),
                prod("Body Filler (Putty)", "3M", "body", 38.0, 15, "kg", "Lightweight polyester filler, 1kg", ["Dent Removal (small)", "Bumper Repair & Paint", "Panel Beating"]),
                prod("Sandpaper Set (80–2000 grit)", "3M", "body", 45.0, 25, "set", "Wet/dry assorted pack", ["Full Body Respray", "Bumper Repair & Paint"]),
            ],
            "created_at": NOW, "updated_at": NOW,
        },

        {
            "_id": w_ids["clearvision"], "owner_id": owner_ids["clearvision"],
            "workshop_name": "ClearVision Glass & Wrap",
            "description": "Windscreen replacement, chip repair, and vehicle wrapping specialists. OEM and aftermarket glass available.",
            "address": "No 15, Jalan Wangsa Delima 12, 53300 Wangsa Maju, KL",
            "phone": "+60155566778",
            "location": {"type": "Point", "coordinates": [101.7370, 3.1920]},
            "latitude": 3.1920, "longitude": 101.7160,
            "rating": 4.5, "total_reviews": 2, "is_open": True,
            "working_hours": working_hours(["sunday"]), "images": [],
            "services": [
                svc("Windscreen Replacement (OEM)", "Genuine OEM windscreen supply and professional fit", 700.0, 120, "body"),
                svc("Windscreen Replacement (Aftermarket)", "Quality aftermarket windscreen, more affordable", 400.0, 90, "body"),
                svc("Windscreen Chip Repair", "Resin injection repair for chips up to 3cm", 80.0, 30, "body"),
                svc("Side/Rear Glass Replacement", "Supply and fit side window or rear windscreen", 350.0, 90, "body"),
                svc("Full Vehicle Wrap", "Premium vinyl wrap with 3-year warranty", 2800.0, 1440, "body"),
                svc("Partial Wrap / Accent", "Roof, bonnet or boot lid wrap", 450.0, 240, "body"),
            ],
            "products": [
                prod("Pilkington OEM Windscreen — Proton", "Pilkington", "body", 520.0, 4, "pcs", "OEM windscreen, Proton compatible", ["Windscreen Replacement (OEM)"]),
                prod("AGC Aftermarket Windscreen (Universal)", "AGC", "body", 280.0, 6, "pcs", "Aftermarket float glass", ["Windscreen Replacement (Aftermarket)"]),
                prod("Windscreen Resin Repair Kit", "Rain-X", "body", 35.0, 20, "pcs", "UV-curing chip repair resin", ["Windscreen Chip Repair"]),
                prod("3M Avery Dennison Wrap Film — Matte Black", "Avery", "body", 280.0, 10, "metre", "1.52m wide matte black vinyl", ["Full Vehicle Wrap", "Partial Wrap / Accent"]),
                prod("3M Avery Dennison Wrap Film — Gloss White", "Avery", "body", 260.0, 10, "metre", "1.52m wide gloss white vinyl", ["Full Vehicle Wrap", "Partial Wrap / Accent"]),
                prod("Urethane Glass Adhesive", "Sika", "body", 55.0, 15, "pcs", "High-strength windscreen bonding adhesive", ["Windscreen Replacement (OEM)", "Windscreen Replacement (Aftermarket)"]),
            ],
            "created_at": NOW, "updated_at": NOW,
        },

        {
            "_id": w_ids["luxe"], "owner_id": owner_ids["luxe"],
            "workshop_name": "Luxe Panel & Paint Studio",
            "description": "Premium spray painting and refinishing studio. Colour matching technology for a factory finish.",
            "address": "18, Lorong Setiawangsa 2, 54200 Kuala Lumpur",
            "phone": "+60166677889",
            "location": {"type": "Point", "coordinates": [101.6200, 3.1520]},
            "latitude": 3.1520, "longitude": 101.7220,
            "rating": 4.8, "total_reviews": 3, "is_open": True,
            "working_hours": working_hours(["saturday", "sunday"]), "images": [],
            "services": [
                svc("Single Panel Respray", "Computer colour-matched respray for one panel", 280.0, 180, "body"),
                svc("Half Body Respray", "Front or rear half respray", 1600.0, 1440, "body"),
                svc("Full Body Respray (Premium)", "Full respray with clear coat and polish", 4200.0, 2880, "body"),
                svc("Scratch & Scuff Repair", "Minor scratch or scuff removal and touch-up", 150.0, 90, "body"),
                svc("Rust Treatment & Repair", "Rust removal, treatment and refinish", 350.0, 240, "body"),
            ],
            "products": [
                prod("Standox Standofleet Basecoat", "Standox", "body", 95.0, 15, "litre", "VOC-compliant waterborne basecoat, 1L", ["Single Panel Respray", "Half Body Respray", "Full Body Respray (Premium)"]),
                prod("Spies Hecker 2K Clearcoat", "Spies Hecker", "body", 110.0, 10, "litre", "Premium 2K clearcoat, 1L", ["Single Panel Respray", "Half Body Respray", "Full Body Respray (Premium)"]),
                prod("U-POL Raptor Texture Coat", "U-POL", "body", 85.0, 8, "pcs", "Tough textured under-body coating, aerosol", ["Rust Treatment & Repair"]),
                prod("Rust Converter", "Jenolite", "body", 45.0, 12, "litre", "Converts rust to stable black primer, 500ml", ["Rust Treatment & Repair"]),
                prod("Masking Film + Tape Kit", "3M", "body", 22.0, 30, "set", "Pre-taped masking film 1.8m x 20m", ["Single Panel Respray", "Half Body Respray", "Full Body Respray (Premium)"]),
            ],
            "created_at": NOW, "updated_at": NOW,
        },

        # ── TYRES & WHEELS ─────────────────────────────────────────────────────
        {
            "_id": w_ids["speedwheel"], "owner_id": owner_ids["speedwheel"],
            "workshop_name": "SpeedWheel Tyre Depot",
            "description": "Malaysia's widest tyre selection. All brands, all sizes. Professional fitting, balancing, and alignment.",
            "address": "No 2, Jalan Kepong 1/6, 52100 Kepong, Kuala Lumpur",
            "phone": "+60177788990",
            "location": {"type": "Point", "coordinates": [101.6380, 3.2050]},
            "latitude": 3.2050, "longitude": 101.6380,
            "rating": 4.5, "total_reviews": 3, "is_open": True,
            "working_hours": working_hours_24_6([]), "images": [],
            "services": [
                svc("Tyre Fitting & Balancing (per tyre)", "Fit and balance one tyre, includes valve stem", 25.0, 20, "tire"),
                svc("4-Wheel Alignment", "Computer-controlled 4-wheel laser alignment", 90.0, 45, "tire"),
                svc("Tyre Rotation", "Rotate all 4 tyres for even wear", 40.0, 30, "tire"),
                svc("Nitrogen Inflation (4 tyres)", "Replace air with pure nitrogen for stable pressure", 30.0, 20, "tire"),
                svc("Puncture Repair", "Patch or plug tyre puncture", 20.0, 20, "tire"),
                svc("Tyre Replacement Package (4 tyres)", "Supply, fit and balance 4 new tyres", 600.0, 90, "tire"),
            ],
            "products": [
                prod("Michelin Pilot Sport 5 (225/45 R17)", "Michelin", "tyre", 420.0, 8, "pcs", "High-perf summer tyre", ["Tyre Replacement Package (4 tyres)", "Tyre Fitting & Balancing (per tyre)"]),
                prod("Continental SportContact 7 (205/55 R16)", "Continental", "tyre", 380.0, 8, "pcs", "Sports tyre, wet and dry grip", ["Tyre Replacement Package (4 tyres)", "Tyre Fitting & Balancing (per tyre)"]),
                prod("Goodyear Assurance TripleMax 2 (195/65 R15)", "Goodyear", "tyre", 270.0, 12, "pcs", "Comfort all-season tyre", ["Tyre Replacement Package (4 tyres)", "Tyre Fitting & Balancing (per tyre)"]),
                prod("Pirelli P7 Cinturato (185/60 R15)", "Pirelli", "tyre", 250.0, 10, "pcs", "Fuel-efficient comfort tyre", ["Tyre Fitting & Balancing (per tyre)"]),
                prod("Hankook Ventus V12 (195/55 R16)", "Hankook", "tyre", 220.0, 12, "pcs", "Value performance tyre", ["Tyre Replacement Package (4 tyres)", "Tyre Fitting & Balancing (per tyre)"]),
                prod("Valve Stem (rubber)", "OEM", "other", 2.0, 100, "pcs", "Standard rubber valve stem", ["Tyre Fitting & Balancing (per tyre)", "Tyre Replacement Package (4 tyres)"]),
                prod("Nitrogen Gas (per set)", "Industrial", "other", 5.0, 50, "set", "Pure nitrogen fill, 4 tyres", ["Nitrogen Inflation (4 tyres)"]),
            ],
            "created_at": NOW, "updated_at": NOW,
        },

        {
            "_id": w_ids["rimcraft"], "owner_id": owner_ids["rimcraft"],
            "workshop_name": "RimCraft Wheel Works",
            "description": "Alloy rim repair, refurbishment, and custom wheel specialist. Restore your rims to showroom condition.",
            "address": "Lot 8, Jalan Rawang Maju, 48000 Rawang, Selangor",
            "phone": "+60188899001",
            "location": {"type": "Point", "coordinates": [101.5760, 3.3190]},
            "latitude": 3.3190, "longitude": 101.5760,
            "rating": 4.6, "total_reviews": 2, "is_open": True,
            "working_hours": working_hours(["sunday"]), "images": [],
            "services": [
                svc("Rim Refurbishment (per rim)", "Diamond cut, powder coat or paint refurbishment", 180.0, 120, "tire"),
                svc("Bent Rim Straightening", "CNC straightening for buckled or bent alloy rims", 120.0, 60, "tire"),
                svc("Powder Coating (per rim)", "Durable powder coat in custom colour", 150.0, 240, "tire"),
                svc("Wheel Alignment (4-wheel)", "Laser 4-wheel alignment with printout", 85.0, 45, "tire"),
                svc("Tyre Fitting & Balancing", "Professional tyre mount and dynamic balancing", 30.0, 20, "tire"),
            ],
            "products": [
                prod("Dupont Powder Coat — Gloss Black", "Dupont", "other", 35.0, 20, "kg", "Gloss black powder coat, per kg", ["Powder Coating (per rim)"]),
                prod("Dupont Powder Coat — Matte Gunmetal", "Dupont", "other", 40.0, 15, "kg", "Matte gunmetal powder coat, per kg", ["Powder Coating (per rim)"]),
                prod("Rim Primer Spray", "Rust-Oleum", "other", 25.0, 20, "pcs", "Self-etching primer for alloy", ["Rim Refurbishment (per rim)"]),
                prod("Tyre Mounting Lubricant", "Beadson", "other", 18.0, 20, "litre", "Tyre bead mounting paste, 1kg", ["Tyre Fitting & Balancing"]),
                prod("Wheel Weight — Stick-On (mixed)", "Hofmann", "other", 15.0, 30, "set", "Assorted adhesive wheel weights, 100g set", ["Tyre Fitting & Balancing"]),
            ],
            "created_at": NOW, "updated_at": NOW,
        },

        # ── BRAKES & SUSPENSION ────────────────────────────────────────────────
        {
            "_id": w_ids["stopright"], "owner_id": owner_ids["stopright"],
            "workshop_name": "StopRight Brake Specialist",
            "description": "Dedicated brake service centre. Pads, discs, calipers, drums and brake fluid for all vehicles.",
            "address": "No 5, Jalan Kapar, 41400 Klang, Selangor",
            "phone": "+60199900112",
            "location": {"type": "Point", "coordinates": [101.4480, 3.0449]},
            "latitude": 3.0449, "longitude": 101.4480,
            "rating": 4.4, "total_reviews": 2, "is_open": True,
            "working_hours": working_hours(["sunday"]), "images": [],
            "services": [
                svc("Brake Pad Replacement (front)", "Supply and fit front brake pads, includes rotor check", 220.0, 60, "brake"),
                svc("Brake Pad Replacement (rear)", "Supply and fit rear brake pads or shoes", 200.0, 60, "brake"),
                svc("Brake Disc Replacement (per axle)", "Supply and fit new brake discs front or rear", 380.0, 90, "brake"),
                svc("Brake Caliper Service", "Strip, clean, lubricate and rebuild caliper", 180.0, 120, "brake"),
                svc("Brake Fluid Flush", "Full brake fluid flush and replace with fresh DOT 4", 80.0, 45, "brake"),
                svc("Full Brake Overhaul", "Pads, discs, fluid, caliper service — complete brake job", 750.0, 180, "brake"),
            ],
            "products": [
                prod("Brembo Front Brake Discs (pair)", "Brembo", "brake", 280.0, 6, "pair", "OE-spec ventilated discs", ["Brake Disc Replacement (per axle)", "Full Brake Overhaul"]),
                prod("TRW Front Brake Pad Set", "TRW", "brake", 90.0, 15, "set", "OEM-quality ceramic pads", ["Brake Pad Replacement (front)", "Full Brake Overhaul"]),
                prod("Brembo Performance Brake Pads", "Brembo", "brake", 150.0, 10, "set", "High-perf semi-metallic pads", ["Brake Pad Replacement (front)"]),
                prod("ATE Rear Brake Shoes (set)", "ATE", "brake", 75.0, 10, "set", "OEM drum brake shoes", ["Brake Pad Replacement (rear)"]),
                prod("Ate DOT 4 Brake Fluid", "ATE", "brake", 22.0, 25, "litre", "Super DOT 4, 500ml", ["Brake Fluid Flush", "Full Brake Overhaul"]),
                prod("Caliper Repair Kit", "OEM", "brake", 45.0, 12, "set", "Piston seal + dust boot kit", ["Brake Caliper Service"]),
                prod("Brake Cleaner Spray", "CRC", "brake", 18.0, 30, "pcs", "500ml aerosol brake cleaner", ["Brake Pad Replacement (front)", "Brake Pad Replacement (rear)", "Full Brake Overhaul"]),
            ],
            "created_at": NOW, "updated_at": NOW,
        },

        {
            "_id": w_ids["suspro"], "owner_id": owner_ids["suspro"],
            "workshop_name": "SuspensionPro Malaysia",
            "description": "Suspension, steering and shock absorber specialists. From comfort to performance setups.",
            "address": "No 31, Jalan Bangsar Utama 1, 59000 Bangsar, Kuala Lumpur",
            "phone": "+60110011223",
            "location": {"type": "Point", "coordinates": [101.6740, 3.1272]},
            "latitude": 3.1272, "longitude": 101.6740,
            "rating": 4.6, "total_reviews": 3, "is_open": True,
            "working_hours": working_hours(["sunday"]), "images": [],
            "services": [
                svc("Shock Absorber Replacement (per unit)", "Supply and fit new shock absorber, includes alignment check", 280.0, 90, "suspension"),
                svc("Coilover Installation", "Fit customer-supplied coilover kit with alignment", 400.0, 180, "suspension"),
                svc("Suspension Bushing Replacement", "Replace worn rubber/polyurethane bushings", 250.0, 120, "suspension"),
                svc("Power Steering Repair", "Diagnose and repair hydraulic or EPS power steering", 350.0, 120, "suspension"),
                svc("Steering Rack Replacement", "Replace leaking or worn steering rack with alignment", 800.0, 240, "suspension"),
                svc("Wheel Alignment (post-suspension)", "4-wheel alignment after suspension work", 90.0, 45, "suspension"),
            ],
            "products": [
                prod("KYB Excel-G Shock Absorber (front)", "KYB", "suspension", 180.0, 8, "pcs", "OE-spec gas shock, per unit", ["Shock Absorber Replacement (per unit)"]),
                prod("Bilstein B4 Shock Absorber (front)", "Bilstein", "suspension", 350.0, 4, "pcs", "Premium gas monotube, per unit", ["Shock Absorber Replacement (per unit)"]),
                prod("Moog Control Arm Bushing Kit", "Moog", "suspension", 85.0, 10, "set", "Front lower control arm bushing set", ["Suspension Bushing Replacement"]),
                prod("SuperPro Polyurethane Bush Kit", "SuperPro", "suspension", 120.0, 8, "set", "Poly bush upgrade kit", ["Suspension Bushing Replacement"]),
                prod("Pentosin CHF 202 Power Steering Fluid", "Pentosin", "other", 45.0, 10, "litre", "CHF 202 PSF, 1L", ["Power Steering Repair"]),
                prod("Sachs Front Spring (per unit)", "Sachs", "suspension", 150.0, 6, "pcs", "OE-spec coil spring", ["Coilover Installation", "Shock Absorber Replacement (per unit)"]),
            ],
            "created_at": NOW, "updated_at": NOW,
        },

        # ── SPECIALIST & PERFORMANCE ───────────────────────────────────────────
        {
            "_id": w_ids["turboking"], "owner_id": owner_ids["turboking"],
            "workshop_name": "TurboKing Performance Centre",
            "description": "Performance tuning, modification and forced induction specialists. From stage 1 tune to full race builds.",
            "address": "No 18, Jalan Serdang Raya, 43300 Seri Kembangan, Selangor",
            "phone": "+60143344556",
            "location": {"type": "Point", "coordinates": [101.7065, 3.0085]},
            "latitude": 3.0085, "longitude": 101.7065,
            "rating": 4.8, "total_reviews": 3, "is_open": True,
            "working_hours": working_hours(["sunday"]), "images": [],
            "services": [
                svc("ECU Stage 1 Tune", "Conservative ECU remap for daily driver, +15-25% power", 650.0, 180, "performance"),
                svc("ECU Stage 2 Tune", "Aggressive remap with hardware upgrades, +30-45% power", 950.0, 240, "performance"),
                svc("Turbocharger Installation", "Fit turbo kit on naturally-aspirated engine", 5500.0, 1440, "performance"),
                svc("Cold Air Intake Installation", "High-flow intake system installation and tune", 350.0, 90, "performance"),
                svc("Exhaust System Upgrade", "Cat-back or full exhaust system replacement", 800.0, 180, "performance"),
                svc("Dyno Run & Power Report", "4WD dyno run with before/after power chart", 250.0, 90, "performance"),
            ],
            "products": [
                prod("Motul 300V Competition 5W-40", "Motul", "lubricant", 85.0, 20, "litre", "Full synthetic race oil, 1L", ["ECU Stage 1 Tune", "ECU Stage 2 Tune", "Turbocharger Installation"]),
                prod("K&N High-Flow Air Filter (drop-in)", "K&N", "filter", 180.0, 8, "pcs", "OEM-replacement performance filter", ["Cold Air Intake Installation"]),
                prod("K&N Cold Air Intake Kit", "K&N", "performance", 420.0, 4, "set", "Complete cold air intake + filter", ["Cold Air Intake Installation"]),
                prod("Tial 38mm Wastegate", "Tial", "performance", 650.0, 3, "pcs", "External wastegate for turbo builds", ["Turbocharger Installation"]),
                prod("HKS Universal BOV (Blow-Off Valve)", "HKS", "performance", 380.0, 4, "pcs", "Universal blow-off valve", ["Turbocharger Installation"]),
                prod("NGK Racing Spark Plug BKR7E", "NGK", "filter", 28.0, 30, "pcs", "Cold-range racing spark plug", ["ECU Stage 2 Tune", "Turbocharger Installation"]),
                prod("Weld-On O2 Bung (stainless)", "Generic", "performance", 15.0, 20, "pcs", "Stainless weld bung for O2 sensor", ["Exhaust System Upgrade"]),
            ],
            "created_at": NOW, "updated_at": NOW,
        },

        {
            "_id": w_ids["greendrive"], "owner_id": owner_ids["greendrive"],
            "workshop_name": "GreenDrive EV & Hybrid Specialist",
            "description": "Malaysia's leading hybrid and electric vehicle specialist. HV battery diagnosis, hybrid system repair and EV charging solutions.",
            "address": "Blok B-5, Cyberjaya Tech Park, 63000 Cyberjaya, Selangor",
            "phone": "+60154455667",
            "location": {"type": "Point", "coordinates": [101.6550, 2.9180]},
            "latitude": 2.9180, "longitude": 101.6550,
            "rating": 4.9, "total_reviews": 2, "is_open": True,
            "working_hours": working_hours(["sunday"]), "images": [],
            "services": [
                svc("Hybrid Battery Health Check", "HV battery capacity test, cell balancing report", 150.0, 90, "performance"),
                svc("Hybrid Battery Reconditioning", "Cell-level reconditioning to restore capacity", 650.0, 240, "performance"),
                svc("Hybrid Battery Replacement", "Replace HV battery pack with tested unit", 3800.0, 480, "performance"),
                svc("EV/Hybrid Diagnostic Scan", "Full HV system scan including motor and inverter", 120.0, 60, "performance"),
                svc("Hybrid Inverter Repair", "Diagnose and repair hybrid inverter/converter", 1200.0, 360, "performance"),
                svc("EV Charging System Check", "Inspect OBC, EVSE inlet and charging control module", 100.0, 60, "electrical"),
            ],
            "products": [
                prod("Toyota Prius HV Battery Cell (Panasonic)", "Panasonic", "electrical", 280.0, 20, "pcs", "OEM Prius 3rd-gen NiMH cell", ["Hybrid Battery Replacement", "Hybrid Battery Reconditioning"]),
                prod("Honda Insight / Jazz Hybrid Battery Module", "Sanyo", "electrical", 320.0, 10, "pcs", "IMA battery module", ["Hybrid Battery Replacement"]),
                prod("Insulation Resistance Tester (HV)", "Fluke", "other", 0.0, 1, "pcs", "Workshop HV safety tool (not for sale — shop use)", ["EV/Hybrid Diagnostic Scan"]),
                prod("Toyota CVT Hybrid Fluid", "Toyota", "lubricant", 55.0, 10, "litre", "WS ATF for Toyota E-CVT, 1L", ["EV/Hybrid Diagnostic Scan"]),
                prod("Thermal Interface Paste (HV)", "Shin-Etsu", "other", 45.0, 8, "pcs", "Thermal compound for HV modules", ["Hybrid Battery Reconditioning", "Hybrid Battery Replacement"]),
            ],
            "created_at": NOW, "updated_at": NOW,
        },

        # ── ACCESSORIES & CUSTOMISATION ────────────────────────────────────────
        {
            "_id": w_ids["soundbox"], "owner_id": owner_ids["soundbox"],
            "workshop_name": "SoundBox Car Audio & Security",
            "description": "Car audio, multimedia, dashcams, reverse cameras and vehicle security systems. Installation by certified technicians.",
            "address": "A-12, Bangsar Shopping Centre Area, 59000 Bangsar South, KL",
            "phone": "+60165566778",
            "location": {"type": "Point", "coordinates": [101.6644, 3.1133]},
            "latitude": 3.1133, "longitude": 101.6644,
            "rating": 4.5, "total_reviews": 2, "is_open": True,
            "working_hours": working_hours_24_6(["sunday"]), "images": [],
            "services": [
                svc("Head Unit (Android) Installation", "Fit Android 10-inch head unit with wiring", 200.0, 90, "accessories"),
                svc("Speaker Upgrade (full set)", "Fit and tune 4 door speakers + tweeter", 250.0, 120, "accessories"),
                svc("Subwoofer & Amplifier Installation", "Under-seat or boot sub with amp, incl. cable kit", 350.0, 150, "accessories"),
                svc("Reverse Camera Installation", "HD reverse camera with guide lines", 150.0, 60, "accessories"),
                svc("Car Alarm & Immobiliser", "2-way alarm with engine immobiliser and remote start", 420.0, 120, "accessories"),
                svc("Dashcam Installation (front + rear)", "Dual dashcam with parking mode wiring", 180.0, 60, "accessories"),
            ],
            "products": [
                prod("Pioneer AVIC-Z7350BT Android Head Unit", "Pioneer", "accessories", 1800.0, 3, "pcs", "10-inch Android, CarPlay + AA", ["Head Unit (Android) Installation"]),
                prod("Sony XAV-AX8000 Head Unit", "Sony", "accessories", 1400.0, 4, "pcs", "9-inch Floating Screen, wireless AA", ["Head Unit (Android) Installation"]),
                prod("Focal Access 165 Speaker Set", "Focal", "accessories", 650.0, 4, "set", "6.5-inch component speakers + tweeter", ["Speaker Upgrade (full set)"]),
                prod("Kenwood KFC-S1766 Speaker Set", "Kenwood", "accessories", 180.0, 8, "set", "Value 6.5-inch coaxial set", ["Speaker Upgrade (full set)"]),
                prod("Viper 5906V 2-Way Alarm", "Viper", "accessories", 680.0, 3, "pcs", "2-way security system with remote start", ["Car Alarm & Immobiliser"]),
                prod("BlackVue DR900X-2CH Dashcam", "BlackVue", "accessories", 1200.0, 3, "pcs", "4K front + 1080p rear cloud dashcam", ["Dashcam Installation (front + rear)"]),
                prod("Thinkware F800 PRO Dashcam", "Thinkware", "accessories", 750.0, 4, "pcs", "FHD front + rear with safety camera", ["Dashcam Installation (front + rear)"]),
            ],
            "created_at": NOW, "updated_at": NOW,
        },

        {
            "_id": w_ids["tintpro"], "owner_id": owner_ids["tintpro"],
            "workshop_name": "TintPro Window Film & Wrap",
            "description": "Premium window tinting with solar control and UV rejection films. Certified 3M and V-Kool installers.",
            "address": "No 9, Jalan Taman Tun Dr Ismail 1, 60000 TTDI, Kuala Lumpur",
            "phone": "+60176677889",
            "location": {"type": "Point", "coordinates": [101.6298, 3.1427]},
            "latitude": 3.1427, "longitude": 101.6298,
            "rating": 4.7, "total_reviews": 3, "is_open": True,
            "working_hours": working_hours(["sunday"]), "images": [],
            "services": [
                svc("Window Tint — Full Car (Basic)", "3M Automotive Series 35% VLT all windows", 380.0, 180, "accessories"),
                svc("Window Tint — Full Car (Premium)", "V-Kool VK40 ceramic film all windows", 980.0, 240, "accessories"),
                svc("Windscreen Film Only", "3M Crystalline CR90 windscreen film", 350.0, 90, "accessories"),
                svc("Paint Protection Film (PPF)", "3M Scotchgard Pro Series hood + bumper", 1200.0, 480, "accessories"),
                svc("Interior Detailing & Upholstery", "Deep clean, shampoo, leather conditioning", 280.0, 180, "accessories"),
                svc("Dashboard Wrap / Interior Trim Wrap", "Carbon fibre or wood-grain vinyl interior trim", 320.0, 150, "accessories"),
            ],
            "products": [
                prod("3M Automotive Window Film AE35", "3M", "accessories", 8.0, 100, "metre", "35% VLT auto series, 0.76m wide", ["Window Tint — Full Car (Basic)"]),
                prod("V-Kool VK40 Ceramic Film", "V-Kool", "accessories", 18.0, 50, "metre", "40% VLT nano-ceramic, 1.52m wide", ["Window Tint — Full Car (Premium)"]),
                prod("3M Crystalline CR90", "3M", "accessories", 25.0, 30, "metre", "90% VLT UV/IR rejection, windscreen", ["Windscreen Film Only"]),
                prod("3M Scotchgard Pro PPF", "3M", "accessories", 45.0, 30, "metre", "Self-healing PPF, 1.52m wide", ["Paint Protection Film (PPF)"]),
                prod("Film Slip Solution", "Chemical Guys", "accessories", 15.0, 20, "litre", "Slip solution for film application, 1L", ["Window Tint — Full Car (Basic)", "Window Tint — Full Car (Premium)"]),
            ],
            "created_at": NOW, "updated_at": NOW,
        },

        # ── CLEANING & DETAILING ───────────────────────────────────────────────
        {
            "_id": w_ids["gleam"], "owner_id": owner_ids["gleam"],
            "workshop_name": "Gleam Pro Detailing Studio",
            "description": "Professional car detailing studio. Ceramic coating, paint correction, and full detail packages.",
            "address": "No 6, Jalan TTDI Jaya 5, 40150 Shah Alam, Selangor",
            "phone": "+60187788990",
            "location": {"type": "Point", "coordinates": [101.6298, 3.1450]},
            "latitude": 3.1450, "longitude": 101.6120,
            "rating": 4.9, "total_reviews": 3, "is_open": True,
            "working_hours": working_hours(["sunday"]), "images": [],
            "services": [
                svc("Basic Exterior Wash & Vacuum", "Hand wash, dry, tyre shine and vacuum interior", 60.0, 60, "detailing"),
                svc("Full Car Detailing (Standard)", "Exterior wash, clay bar, polish, wax, interior shampoo", 350.0, 240, "detailing"),
                svc("Full Car Detailing (Premium)", "Machine polish, paint correction, ceramic spray + interior", 650.0, 360, "detailing"),
                svc("Ceramic Coating (9H)", "Professional 9H ceramic coating with 2-year warranty", 1800.0, 480, "detailing"),
                svc("Paint Correction (single stage)", "Remove swirls and light scratches with machine polish", 500.0, 300, "detailing"),
                svc("Headlight Restoration", "Wet sand and polish cloudy or yellowed headlights", 120.0, 60, "detailing"),
            ],
            "products": [
                prod("Gtechniq Crystal Serum Ultra (CSU)", "Gtechniq", "detailing", 380.0, 5, "pcs", "Professional 9H ceramic, 50ml", ["Ceramic Coating (9H)"]),
                prod("CarPro Cquartz UK 3.0", "CarPro", "detailing", 220.0, 8, "pcs", "Consumer ceramic coating kit, 50ml", ["Ceramic Coating (9H)"]),
                prod("Menzerna Heavy Cut Compound 400", "Menzerna", "detailing", 85.0, 10, "pcs", "Heavy cut polish for paint correction, 1kg", ["Paint Correction (single stage)", "Full Car Detailing (Premium)"]),
                prod("Gyeon Q2M Cure Spray Ceramic", "Gyeon", "detailing", 65.0, 8, "pcs", "Spray ceramic sealant, 400ml", ["Full Car Detailing (Standard)"]),
                prod("Sonax Brilliant Shine Detailer", "Sonax", "detailing", 45.0, 12, "pcs", "Quick detailer spray, 500ml", ["Full Car Detailing (Standard)", "Basic Exterior Wash & Vacuum"]),
                prod("Meguiar's Headlight Restoration Kit", "Meguiar's", "detailing", 55.0, 10, "set", "Wet sand + polish + UV coat kit", ["Headlight Restoration"]),
                prod("Koch Chemie One Cut & Finish", "Koch Chemie", "detailing", 95.0, 6, "pcs", "All-in-one cut and finish polish, 1L", ["Full Car Detailing (Premium)", "Paint Correction (single stage)"]),
            ],
            "created_at": NOW, "updated_at": NOW,
        },

        {
            "_id": w_ids["pureshine"], "owner_id": owner_ids["pureshine"],
            "workshop_name": "PureShine Auto Spa",
            "description": "Complete auto spa services including engine bay cleaning, interior detailing, and full-car grooming packages.",
            "address": "No 22, Jalan Jalil Jaya 2, 57000 Bukit Jalil, Kuala Lumpur",
            "phone": "+60198899001",
            "location": {"type": "Point", "coordinates": [101.6845, 3.0571]},
            "latitude": 3.0571, "longitude": 101.6845,
            "rating": 4.4, "total_reviews": 2, "is_open": True,
            "working_hours": working_hours_24_6([]), "images": [],
            "services": [
                svc("Engine Bay Cleaning & Dressing", "Steam clean engine bay, degrease and dress plastics", 120.0, 90, "detailing"),
                svc("Interior Deep Clean", "Full interior vacuum, shampoo seats, clean all surfaces", 200.0, 150, "detailing"),
                svc("Leather Seat Conditioning", "Clean, condition and protect leather seats", 180.0, 90, "detailing"),
                svc("Ozone & Odour Treatment", "Eliminate smoke, mould and pet odour with ozone machine", 100.0, 60, "detailing"),
                svc("Full Grooming Package", "Exterior wash + engine bay + full interior detailing", 380.0, 300, "detailing"),
                svc("Undercarriage Wash & Coat", "High-pressure underbody wash with anti-rust coating", 150.0, 60, "detailing"),
            ],
            "products": [
                prod("Bilt Hamber Engine Degreaser", "Bilt Hamber", "detailing", 55.0, 15, "pcs", "Non-caustic engine degreaser, 500ml", ["Engine Bay Cleaning & Dressing"]),
                prod("Chemical Guys Silk Shine Dressing", "Chemical Guys", "detailing", 45.0, 12, "pcs", "Water-based trim dressing, 500ml", ["Engine Bay Cleaning & Dressing"]),
                prod("Koch Chemie Leather Care Set", "Koch Chemie", "detailing", 95.0, 8, "set", "Cleaner + conditioner, 500ml each", ["Leather Seat Conditioning"]),
                prod("Meguiar's Carpet & Upholstery Cleaner", "Meguiar's", "detailing", 35.0, 15, "pcs", "Foaming carpet and seat cleaner, 400ml", ["Interior Deep Clean", "Full Grooming Package"]),
                prod("Dinitrol 4941 Underbody Wax", "Dinitrol", "detailing", 65.0, 10, "pcs", "Anti-corrosion underbody spray, 1L", ["Undercarriage Wash & Coat"]),
                prod("Odour Bomb (new car scent)", "Neutra Air", "detailing", 20.0, 20, "pcs", "Total-release odour eliminator bomb", ["Ozone & Odour Treatment"]),
            ],
            "created_at": NOW, "updated_at": NOW,
        },
    ]

    await db.workshops.insert_many(workshops)
    await db.workshops.create_index([("location", "2dsphere")])
    print(f"✓ Created {len(workshops)} workshops")

    # ── Bookings ──────────────────────────────────────────────────────────────
    c1, c2, c3, c4 = customers
    w_hafiz  = workshops[0]
    w_ken    = workshops[1]
    w_ql     = workshops[2]
    w_razif  = workshops[8]
    w_turbo  = workshops[17]

    tomorrow  = (NOW + timedelta(days=1)).strftime("%Y-%m-%d")
    yesterday = (NOW - timedelta(days=2)).strftime("%Y-%m-%d")
    last_week = (NOW - timedelta(days=7)).strftime("%Y-%m-%d")

    b1_id = oid(); b2_id = oid(); b3_id = oid(); b4_id = oid(); b5_id = oid()

    bookings = [
        {
            "_id": b1_id,
            "customer_id": c1["_id"], "customer_name": c1["name"], "customer_phone": c1["phone"],
            "workshop_id": w_ids["hafiz"], "workshop_name": w_hafiz["workshop_name"],
            "workshop_address": w_hafiz["address"], "workshop_owner_id": owner_ids["hafiz"],
            "services": [w_hafiz["services"][0]], "vehicle_plate": "WXY 1234", "vehicle_name": "Myvi",
            "vehicle_brand": "Perodua", "scheduled_date": tomorrow, "scheduled_time": "10:00",
            "notes": "Please check the brake fluid level too",
            "status": "pending", "total_price": 80.0,
            "payment_status": "unpaid", "payment_intent_id": None,
            "created_at": NOW, "updated_at": NOW,
        },
        {
            "_id": b2_id,
            "customer_id": c2["_id"], "customer_name": c2["name"], "customer_phone": c2["phone"],
            "workshop_id": w_ids["hafiz"], "workshop_name": w_hafiz["workshop_name"],
            "workshop_address": w_hafiz["address"], "workshop_owner_id": owner_ids["hafiz"],
            "services": [w_hafiz["services"][0], w_hafiz["services"][1]],
            "vehicle_plate": "PQR 9012", "vehicle_name": "Persona",
            "vehicle_brand": "Proton", "scheduled_date": tomorrow, "scheduled_time": "14:00",
            "notes": "", "status": "confirmed", "total_price": 300.0,
            "payment_status": "unpaid", "payment_intent_id": None,
            "created_at": NOW - timedelta(hours=2), "updated_at": NOW,
        },
        {
            "_id": b3_id,
            "customer_id": c1["_id"], "customer_name": c1["name"], "customer_phone": c1["phone"],
            "workshop_id": w_ids["ken"], "workshop_name": w_ken["workshop_name"],
            "workshop_address": w_ken["address"], "workshop_owner_id": owner_ids["ken"],
            "services": [w_ken["services"][0]], "vehicle_plate": "WXY 1234", "vehicle_name": "Myvi",
            "vehicle_brand": "Perodua", "scheduled_date": last_week, "scheduled_time": "09:00",
            "notes": "Car has been vibrating at high speed",
            "status": "completed", "total_price": 450.0,
            "payment_status": "paid", "payment_intent_id": "pi_mock_demo",
            "completion_notes": "Full service done. Found and fixed loose front tyre nut causing vibration.",
            "next_service_months": 6,
            "created_at": NOW - timedelta(days=8), "updated_at": NOW - timedelta(days=7),
        },
        {
            "_id": b4_id,
            "customer_id": c2["_id"], "customer_name": c2["name"], "customer_phone": c2["phone"],
            "workshop_id": w_ids["ken"], "workshop_name": w_ken["workshop_name"],
            "workshop_address": w_ken["address"], "workshop_owner_id": owner_ids["ken"],
            "services": [w_ken["services"][2], w_ken["services"][3]],
            "vehicle_plate": "PQR 9012", "vehicle_name": "Persona",
            "vehicle_brand": "Proton", "scheduled_date": yesterday, "scheduled_time": "11:00",
            "notes": "Car pulls to the left",
            "status": "in_progress", "total_price": 280.0,
            "payment_status": "unpaid", "payment_intent_id": None,
            "created_at": NOW - timedelta(days=3), "updated_at": NOW - timedelta(days=1),
        },
        {
            "_id": b5_id,
            "customer_id": c3["_id"], "customer_name": c3["name"], "customer_phone": c3["phone"],
            "workshop_id": w_ids["turboking"], "workshop_name": w_turbo["workshop_name"],
            "workshop_address": w_turbo["address"], "workshop_owner_id": owner_ids["turboking"],
            "services": [w_turbo["services"][0]], "vehicle_plate": "VJK 3344", "vehicle_name": "Civic",
            "vehicle_brand": "Honda", "scheduled_date": yesterday, "scheduled_time": "13:00",
            "notes": "Want Stage 1 tune for better fuel economy on highway",
            "status": "confirmed", "total_price": 650.0,
            "payment_status": "unpaid", "payment_intent_id": None,
            "created_at": NOW - timedelta(days=1), "updated_at": NOW - timedelta(hours=12),
        },
    ]
    await db.bookings.insert_many(bookings)
    print(f"✓ Created {len(bookings)} bookings")

    # ── Chat messages ─────────────────────────────────────────────────────────
    messages = [
        {"_id": oid(), "booking_id": b2_id, "sender_id": c2["_id"], "sender_name": c2["name"], "sender_role": "customer", "content": "Hi, I wanted to confirm my booking for tomorrow at 2pm.", "is_read": True, "created_at": NOW - timedelta(hours=1, minutes=30)},
        {"_id": oid(), "booking_id": b2_id, "sender_id": owner_ids["hafiz"], "sender_name": "Hafiz Auto Workshop", "sender_role": "workshop", "content": "Hello! Yes, your booking is confirmed. Please arrive 5 minutes early.", "is_read": True, "created_at": NOW - timedelta(hours=1)},
        {"_id": oid(), "booking_id": b2_id, "sender_id": c2["_id"], "sender_name": c2["name"], "sender_role": "customer", "content": "Great, thank you! Will do.", "is_read": False, "created_at": NOW - timedelta(minutes=30)},
        {"_id": oid(), "booking_id": b3_id, "sender_id": c1["_id"], "sender_name": c1["name"], "sender_role": "customer", "content": "Is my car ready for collection?", "is_read": True, "created_at": NOW - timedelta(days=7, hours=2)},
        {"_id": oid(), "booking_id": b3_id, "sender_id": owner_ids["ken"], "sender_name": "Ken Auto Care", "sender_role": "workshop", "content": "Yes! Your car is ready. We also topped up the coolant. Total is RM450.", "is_read": True, "created_at": NOW - timedelta(days=7, hours=1)},
    ]
    await db.messages.insert_many(messages)
    print(f"✓ Created {len(messages)} chat messages")

    # ── Reviews ───────────────────────────────────────────────────────────────
    def rev(booking_id, workshop_key, customer_id, customer_name, rating, comment, days_ago):
        return {
            "_id": oid(), "booking_id": booking_id,
            "workshop_id": w_ids[workshop_key], "customer_id": customer_id,
            "customer_name": customer_name, "rating": rating, "comment": comment,
            "created_at": NOW - timedelta(days=days_ago),
        }

    reviews = [
        # Hafiz
        rev(oid(), "hafiz", c2["_id"], "Farah Hani", 5.0, "Excellent! Very professional and fast. Will definitely come back.", 14),
        rev(oid(), "hafiz", oid(), "Rajan Kumar", 4.5, "Good workshop, reasonable prices and honest mechanics.", 10),
        rev(oid(), "hafiz", oid(), "Lee Wei Liang", 4.5, "Brought my car in for a full tune-up. Great results!", 5),
        rev(oid(), "hafiz", oid(), "Amirah Syahira", 4.8, "Fast service and friendly staff. AC works perfectly now.", 3),
        # Ken
        rev(b3_id, "ken", c1["_id"], "Ahmad Rizal", 4.0, "Good service, car runs smoothly now. Waiting time was a bit long.", 6),
        rev(oid(), "ken", oid(), "Priya Devi", 4.8, "Fast and efficient. Fixed my alignment issue perfectly.", 3),
        rev(oid(), "ken", oid(), "James Lim", 4.5, "Reasonable price for a full service. Will return.", 8),
        # Razif
        rev(oid(), "razif", oid(), "Amirul Hafiz", 4.2, "Good body work but took longer than expected.", 20),
        rev(oid(), "razif", oid(), "Nurul Ain", 4.3, "Panel beating looks great, very satisfied with the paint match.", 7),
        # QuickLube
        rev(oid(), "quicklube", oid(), "Zulaikha Mahmud", 4.5, "Super fast oil change, in and out in 25 minutes!", 5),
        rev(oid(), "quicklube", oid(), "David Tan", 4.6, "Convenient location and honest staff. No upselling.", 9),
        rev(oid(), "quicklube", oid(), "Kavitha Nair", 4.4, "Great for a quick service before a road trip.", 2),
        # AutoCare
        rev(oid(), "autocare", oid(), "Syazwan Aziz", 4.3, "Very thorough inspection report. Found issues I didn't know about.", 12),
        rev(oid(), "autocare", oid(), "Michelle Wong", 4.4, "Pre-purchase inspection saved me from buying a lemon!", 4),
        # Azman Engine
        rev(oid(), "azman", oid(), "Faizal Kamarudin", 4.7, "Engine overhaul was flawless. Car runs like new.", 15),
        rev(oid(), "azman", oid(), "Rashid Hamid", 4.5, "Honest diagnosis, didn't try to overcharge. Very satisfied.", 8),
        rev(oid(), "azman", oid(), "Ben Chong", 4.6, "Clutch replacement done perfectly, gear changes are smooth now.", 3),
        # Gear & Drive
        rev(oid(), "gear", oid(), "Hairul Nizam", 4.5, "Gearbox rebuild was done professionally. No more slipping.", 11),
        rev(oid(), "gear", oid(), "Suresh Pillai", 4.4, "ATF service made a noticeable difference in shifts.", 6),
        rev(oid(), "gear", oid(), "Cindy Ong", 4.6, "CV joint replacement, very smooth now. Reasonable price.", 2),
        # PowerTech
        rev(oid(), "powertech", oid(), "Azri Ramlan", 4.4, "Alternator replacement fixed my charging issue. Good price.", 9),
        rev(oid(), "powertech", oid(), "Sandra Lim", 4.3, "Wiring repair was tricky but they found the fault quickly.", 4),
        # DiagnostixPro
        rev(oid(), "diagnostix", oid(), "Hafidz Azrul", 4.8, "Stage 1 tune really improved fuel economy on highway driving.", 7),
        rev(oid(), "diagnostix", oid(), "Kenny Ho", 4.7, "ECU scan was thorough and they explained everything clearly.", 3),
        rev(oid(), "diagnostix", oid(), "Suraya Malik", 4.6, "AC compressor replaced, blows very cold now. Great job!", 1),
        # ClearVision
        rev(oid(), "clearvision", oid(), "Norzahra Bakar", 4.5, "Windscreen replaced perfectly, no leaks, great adhesive job.", 10),
        rev(oid(), "clearvision", oid(), "Eric Lau", 4.6, "Vinyl wrap on the roof looks stunning. Very clean installation.", 5),
        # Luxe Panel
        rev(oid(), "luxe", oid(), "Farhana Idris", 4.8, "Colour match was spot on! You can't tell the panel was resprayed.", 8),
        rev(oid(), "luxe", oid(), "Marcus Teo", 4.7, "Premium respray quality, worth every ringgit.", 3),
        rev(oid(), "luxe", oid(), "Nor Hafeeza", 4.9, "Rust treatment and respray, looks brand new. Superb work!", 1),
        # SpeedWheel
        rev(oid(), "speedwheel", oid(), "Afiq Syazwan", 4.5, "Wide selection of tyres, fitted quickly and professionally.", 6),
        rev(oid(), "speedwheel", oid(), "Jenny Teoh", 4.4, "Good price on Michelin tyres, alignment done perfectly.", 3),
        rev(oid(), "speedwheel", oid(), "Ramesh Kumar", 4.6, "Fast service, no appointment needed. Will definitely be back.", 1),
        # RimCraft
        rev(oid(), "rimcraft", oid(), "Hazwan Rosli", 4.7, "Bent rim straightened perfectly, no more vibration at speed.", 12),
        rev(oid(), "rimcraft", oid(), "Alicia Chai", 4.5, "Powder coat in gunmetal looks amazing, very quality finish.", 4),
        # StopRight
        rev(oid(), "stopright", oid(), "Faruq Izwan", 4.4, "Full brake overhaul done, brakes feel much better now.", 7),
        rev(oid(), "stopright", oid(), "Lim Siew Meng", 4.5, "Brembo discs fitted correctly, stops on a dime now.", 2),
        # SuspensionPro
        rev(oid(), "suspro", oid(), "Irfan Mustafar", 4.7, "Coilover install was clean and alignment spot on. Great ride.", 9),
        rev(oid(), "suspro", oid(), "Natasha Zainal", 4.5, "Shock absorber replacement, car handles so much better now.", 5),
        rev(oid(), "suspro", oid(), "Kevin Yong", 4.6, "Power steering repaired, no more heaviness in the wheel.", 1),
        # TurboKing
        rev(oid(), "turboking", oid(), "Hafiz Ismail", 4.9, "Stage 2 tune transformed my car. Night and day difference!", 10),
        rev(oid(), "turboking", oid(), "Raymond Goh", 4.8, "Intake and exhaust upgrade plus dyno run. Very professional.", 5),
        rev(oid(), "turboking", oid(), "Shahrul Nizam", 4.7, "Stage 1 tune improved both power and fuel economy. Impressed!", 2),
        # GreenDrive
        rev(oid(), "greendrive", oid(), "Azlinda Nordin", 4.9, "Hybrid battery reconditioned, my Prius is back to 80% charge capacity!", 11),
        rev(oid(), "greendrive", oid(), "Dr. Chong Wei", 4.8, "Only specialist in KL who really understands EV systems. Trust them 100%.", 3),
        # SoundBox
        rev(oid(), "soundbox", oid(), "Khairul Amir", 4.5, "Pioneer head unit installation was clean, no loose wires. Love it.", 8),
        rev(oid(), "soundbox", oid(), "Tracy Wong", 4.6, "Subwoofer and amp setup sounds amazing, well tuned too.", 3),
        # TintPro
        rev(oid(), "tintpro", oid(), "Norhafizan Ahmad", 4.8, "V-Kool ceramic tint, massive heat rejection. Car stays cool now.", 7),
        rev(oid(), "tintpro", oid(), "Sean Lim", 4.7, "PPF on bonnet and bumper done perfectly. Very clean application.", 3),
        rev(oid(), "tintpro", oid(), "Liyana Yusof", 4.6, "3M tint quality is great and the price is fair. Recommended!", 1),
        # Gleam
        rev(oid(), "gleam", oid(), "Farhan Ariff", 5.0, "Ceramic coating is flawless. Water beads like crazy. 10/10!", 9),
        rev(oid(), "gleam", oid(), "Michelle Lau", 4.8, "Paint correction removed all the swirls. Car looks showroom new.", 4),
        rev(oid(), "gleam", oid(), "Zaki Hassan", 4.9, "Full detail package worth every sen. Best detailing in KL!", 1),
        # PureShine
        rev(oid(), "pureshine", oid(), "Aiman Faris", 4.5, "Engine bay cleaning was thorough, looks brand new under the hood.", 6),
        rev(oid(), "pureshine", oid(), "Poh Bee Lin", 4.3, "Interior deep clean removed all pet hair and odour. Impressed!", 2),
    ]

    await db.reviews.insert_many(reviews)
    print(f"✓ Created {len(reviews)} reviews")

    # Update actual ratings based on seeded reviews
    for key in w_ids:
        wid = w_ids[key]
        cursor = db.reviews.find({"workshop_id": wid})
        all_r = await cursor.to_list(None)
        if all_r:
            avg = sum(r["rating"] for r in all_r) / len(all_r)
            await db.workshops.update_one(
                {"_id": wid},
                {"$set": {"rating": round(avg, 1), "total_reviews": len(all_r)}}
            )
    print("✓ Updated workshop ratings from seeded reviews")

    client.close()

    print("\n════════════════════════════════════════════════════════════")
    print("  Seed complete! Login credentials:")
    print("════════════════════════════════════════════════════════════")
    print("  CUSTOMERS:")
    print("    ahmad@example.com      / password123")
    print("    siti@example.com       / password123")
    print("    rajan@example.com      / password123")
    print("    wei@example.com        / password123")
    print("  WORKSHOPS (sample):")
    print("    hafiz@workshop.com     / password123  (Maintenance)")
    print("    ken@workshop.com       / password123  (Maintenance)")
    print("    razif@workshop.com     / password123  (Body & Exterior)")
    print("    azman@workshop.com     / password123  (Mechanical)")
    print("    gear@workshop.com      / password123  (Transmission)")
    print("    powertech@workshop.com / password123  (Electrical)")
    print("    diagnostix@workshop.com/ password123  (ECU & AC)")
    print("    clearvision@workshop.com/password123  (Glass & Wrap)")
    print("    luxe@workshop.com      / password123  (Panel & Paint)")
    print("    speedwheel@workshop.com/ password123  (Tyres)")
    print("    rimcraft@workshop.com  / password123  (Rims)")
    print("    stopright@workshop.com / password123  (Brakes)")
    print("    suspro@workshop.com    / password123  (Suspension)")
    print("    quicklube@workshop.com / password123  (Quick Service)")
    print("    autocare@workshop.com  / password123  (Preventive Care)")
    print("    turboking@workshop.com / password123  (Performance)")
    print("    greendrive@workshop.com/ password123  (EV & Hybrid)")
    print("    soundbox@workshop.com  / password123  (Audio & Security)")
    print("    tintpro@workshop.com   / password123  (Tint & Wrap)")
    print("    gleam@workshop.com     / password123  (Detailing)")
    print("    pureshine@workshop.com / password123  (Auto Spa)")
    print("════════════════════════════════════════════════════════════")


if __name__ == "__main__":
    asyncio.run(seed())
