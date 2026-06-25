"""
Adds service_tags to existing products in MongoDB based on product category
and what services the workshop actually offers.
Run: PATH=/var/data/python/bin:$PATH python migrate_product_tags.py
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

# category → candidate service name fragments (case-insensitive substring match)
CATEGORY_SERVICE_KEYWORDS = {
    "lubricant":  ["oil change", "full car service", "tune-up", "full service"],
    "filter":     ["oil change", "full car service", "tune-up", "full service"],
    "brake":      ["brake", "full car service", "full service"],
    "electrical": ["battery", "air-con", "tune-up", "full car service", "full service"],
    "tyre":       ["tyre", "tire", "alignment", "rotation", "balancing"],
    "body":       ["dent", "respray", "bumper", "windscreen", "body", "paint", "full car service"],
    "other":      ["full car service", "full service", "tune-up"],
}


def pick_tags(category: str, service_names: list[str]) -> list[str]:
    keywords = CATEGORY_SERVICE_KEYWORDS.get(category, [])
    tags = []
    for svc_name in service_names:
        lower = svc_name.lower()
        if any(kw in lower for kw in keywords):
            tags.append(svc_name)
    return tags


async def main():
    db = AsyncIOMotorClient("mongodb://localhost:27017")["carbooking"]
    workshops = await db.workshops.find({}).to_list(None)

    for w in workshops:
        service_names = [s["name"] for s in w.get("services", []) if s.get("is_active", True)]
        products = w.get("products", [])
        updated = False

        for p in products:
            new_tags = pick_tags(p.get("category", "other"), service_names)
            if p.get("service_tags") != new_tags:
                p["service_tags"] = new_tags
                updated = True

        if updated:
            await db.workshops.update_one(
                {"_id": w["_id"]},
                {"$set": {"products": products}},
            )
            print(f"✓ Updated {w['workshop_name']} ({len(products)} products)")
        else:
            print(f"  Skipped {w['workshop_name']} (no changes)")

    # Show a sample
    workshops = await db.workshops.find({}).to_list(None)
    for w in workshops:
        print(f"\n{w['workshop_name']}")
        for p in w.get("products", [])[:4]:
            print(f"  [{p.get('category')}] {p['name']} → {p.get('service_tags', [])}")


asyncio.run(main())
