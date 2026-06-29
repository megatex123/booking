"""Shared helpers for feature flag resolution."""
from datetime import datetime


DEFAULT_FLAGS = [
    {"key": "customer_queue_join",      "label": "Queue Join",           "group": "customer", "description": "Customers can join workshop queues remotely"},
    {"key": "customer_vehicle_health",  "label": "Car Health Score",     "group": "customer", "description": "Vehicle health scoring and service reminders"},
    {"key": "customer_service_history", "label": "Service History",      "group": "customer", "description": "Unified service timeline and manual logs"},
    {"key": "customer_loyalty",         "label": "Loyalty Program",      "group": "customer", "description": "Points, tiers, and rewards"},
    {"key": "customer_referral",        "label": "Referral Program",     "group": "customer", "description": "Referral codes and credit rewards"},
    {"key": "customer_compare",         "label": "Compare Workshops",    "group": "customer", "description": "Side-by-side workshop comparison"},
    {"key": "customer_corporate",       "label": "Corporate Accounts",   "group": "customer", "description": "Corporate fleet registration"},
    {"key": "customer_chat",            "label": "In-app Chat",          "group": "customer", "description": "Real-time chat with workshop staff"},
    {"key": "vendor_staff_scheduling",  "label": "Staff Scheduling",     "group": "vendor",   "description": "Roster mechanics by day and shift"},
    {"key": "vendor_queue_management",  "label": "Walk-in Queue",        "group": "vendor",   "description": "Live walk-in queue management"},
    {"key": "vendor_analytics",         "label": "Analytics",            "group": "vendor",   "description": "Revenue charts and insights dashboard"},
    {"key": "vendor_product_inventory", "label": "Product Inventory",    "group": "vendor",   "description": "Spare parts and materials management"},
    {"key": "vendor_workshop_layout",   "label": "Workshop Layout",      "group": "vendor",   "description": "Repair bay assignment and management"},
    {"key": "vendor_customer_crm",      "label": "Customer CRM",         "group": "vendor",   "description": "Past customers and visit history"},
    {"key": "vendor_panel_settings",    "label": "Panel Settings",       "group": "vendor",   "description": "Insurance panel provider configuration"},
    {"key": "vendor_promotions",        "label": "Promotions",           "group": "vendor",   "description": "Flash deals and time-limited offers"},
]


async def ensure_defaults(db):
    for flag in DEFAULT_FLAGS:
        await db.feature_flags.update_one(
            {"key": flag["key"]},
            {"$setOnInsert": {**flag, "enabled": True, "created_at": datetime.utcnow()}},
            upsert=True,
        )


async def get_merged_flags(db, user_id: str) -> list[dict]:
    """Return global flags merged with any per-user overrides."""
    await ensure_defaults(db)
    global_flags = await db.feature_flags.find({}, {"_id": 0}).sort("group", 1).to_list(100)
    override_docs = await db.user_feature_overrides.find({"user_id": user_id}).to_list(100)
    overrides = {o["feature_key"]: o for o in override_docs}

    result = []
    for flag in global_flags:
        merged = dict(flag)
        if flag["key"] in overrides:
            ov = overrides[flag["key"]]
            merged["enabled"] = ov["enabled"]
            merged["overridden"] = True
            merged["global_enabled"] = flag["enabled"]
        else:
            merged["overridden"] = False
            merged["global_enabled"] = flag["enabled"]
        result.append(merged)
    return result
