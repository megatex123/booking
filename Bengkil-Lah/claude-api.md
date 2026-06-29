# Claude API — AI Features for Bengkil Lah

This note covers how Anthropic's Claude API can be integrated into the Bengkil Lah system to power intelligent, context-aware features for both customers and workshop vendors.

All features below are **future / planned** — none are currently implemented. See [[Future Features]] for the broader roadmap.

---

## Why Claude API

Claude is well-suited for this app because:
- **Multilingual** — handles Malay and English natively, critical for Malaysian users
- **Context-aware reasoning** — can interpret vague car symptoms, not just keywords
- **Structured output** — can return JSON for service recommendations, summaries, etc.
- **Long context** — can ingest full service history, chat logs, and booking data at once
- **Safety** — avoids hallucinating dangerous mechanical advice by defaulting to "see a mechanic"

Base model recommendation: **`claude-haiku-4-5`** for low-latency in-app features (cheaper, fast), **`claude-sonnet-4-6`** for complex generation tasks (reports, analytics).

---

## Feature 1 — AI Service Advisor (Symptom → Service)

**Priority:** High  
**Replaces/upgrades:** The keyword-mapper Tier 1 in [[Future Features]] → AI Service Advisor

### What it does
Customer types a symptom in free text ("bunyi pelik bila brek", "kereta getaran masa highway") and Claude returns:
- Which service categories are likely needed
- A plain-language explanation of why
- A confidence level (high / medium / low)
- A safety flag if the symptom could indicate a dangerous issue

### API call sketch
```python
# backend/routers/ai.py
import anthropic

client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env

async def suggest_services(symptom: str, vehicle: dict, history: list[dict]) -> dict:
    prompt = f"""
You are a car service advisor for Malaysian drivers. A customer describes a symptom.
Suggest which workshop services they likely need. Reply in JSON only.

Vehicle: {vehicle['brand']} {vehicle['name']} ({vehicle.get('year','')})
Recent service history: {history[-3:] if history else 'None'}
Customer symptom: "{symptom}"

Reply with:
{{
  "services": ["Service Name 1", "Service Name 2"],
  "explanation": "Short plain-language reason (1-2 sentences, match customer language)",
  "confidence": "high|medium|low",
  "safety_warning": "null or a short warning if dangerous"
}}
"""
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}]
    )
    return json.loads(message.content[0].text)
```

### Frontend integration
- Floating AI chip on `BookingScreen` below the service list: **"Not sure? Describe your problem →"**
- Opens a modal with a text input and a "Ask AI" button
- Returns highlighted service cards matching the suggestion
- Suggestion is stored on the booking as `ai_suggestion_used: true` for analytics

---

## Feature 2 — Smart Review Summariser

**Priority:** Medium

### What it does
Workshop detail page shows a single AI-generated summary paragraph of all reviews instead of (or alongside) the raw list. Useful when a workshop has 50+ reviews.

```
"Customers consistently praise Hafiz Auto for fast oil changes and friendly staff. 
Several reviews mention the workshop is particularly good with Perodua models. 
A few noted parking can be tight during peak hours."
```

### API call sketch
```python
async def summarise_reviews(reviews: list[dict], workshop_name: str) -> str:
    joined = "\n".join(
        f"- ({r['rating']}/5): {r['comment']}" for r in reviews[:30] if r.get('comment')
    )
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=150,
        messages=[{"role": "user", "content":
            f"Summarise these customer reviews for '{workshop_name}' in 2–3 sentences. "
            f"Be factual and balanced.\n\n{joined}"
        }]
    )
    return message.content[0].text.strip()
```

### Caching
Summary is cached in `workshops.ai_review_summary` and regenerated when `total_reviews` changes by ≥5. Avoids calling the API on every page load.

---

## Feature 3 — Completion Report Auto-Writer

**Priority:** Medium  
**Audience:** Workshop vendors

### What it does
When a vendor marks a booking **completed**, they must fill in `completion_notes`. Claude pre-fills a professional draft based on:
- Services performed
- Products used (from `service_reports.products_used`)
- Vehicle info

The vendor can edit before saving.

```
Draft: "Performed full engine oil change using Castrol GTX 5W-30 (4L) and replaced oil filter. 
Brake pads (front) replaced — old pads at 10% remaining. Vehicle test-driven post-service, 
all systems normal. Recommend next service in 6 months or 10,000 km."
```

### API call sketch
```python
async def draft_completion_report(booking: dict) -> str:
    services = [s['name'] for s in booking['service_reports']]
    products = [
        f"{p['name']} x{p['quantity']}"
        for sr in booking['service_reports']
        for p in sr.get('products_used', [])
    ]
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=200,
        messages=[{"role": "user", "content":
            f"Write a short professional workshop completion note (3–4 sentences) for:\n"
            f"Vehicle: {booking['vehicle_brand']} {booking['vehicle_name']} ({booking['vehicle_plate']})\n"
            f"Services done: {', '.join(services)}\n"
            f"Parts used: {', '.join(products) or 'none recorded'}\n"
            f"Write as if the workshop mechanic is reporting to the customer."
        }]
    )
    return message.content[0].text.strip()
```

### Frontend integration
"✨ Auto-draft" button in the `WorkshopBookingDetailScreen` completion modal, next to the `completion_notes` text area.

---

## Feature 4 — AI Chat Assistant (Customer Support Bot)

**Priority:** Medium–Low

### What it does
A dedicated AI chat tab (separate from the booking-scoped mechanic chat) where customers can ask general questions:
- "What is an engine flush?"
- "How often should I change my brake fluid?"
- "Is it safe to drive with a blinking engine light?"

Claude responds in the customer's language (BM or English), detected from their app language setting.

### Context passed to Claude
- User's vehicle list
- Last 3 completed bookings
- Current app language (`en` or `ms`)

### System prompt
```
You are a helpful car service assistant for Bengkil Lah, a Malaysian workshop booking app.
Answer questions about car maintenance, services, and the app itself.
Always recommend booking a professional mechanic for diagnosis — never give a definitive fault diagnosis.
Reply in {language}. Keep answers concise (under 100 words unless the question requires more).
User vehicles: {vehicles}
```

### Moderation
Reject off-topic questions (e.g. cooking, politics) with a polite redirect using Claude's built-in safety.

---

## Feature 5 — Analytics Insight Narrator

**Priority:** Low  
**Audience:** Workshop vendors

### What it does
On the `AnalyticsDashboardScreen`, an "AI Insights" card appears below the charts with a plain-English narrative generated from the analytics data.

```
"Your busiest day this month was Saturday 14 June with 8 bookings. Oil Change remains 
your top earner at 42% of revenue. You have 3 repeat customers this month — consider 
sending them a loyalty reward to encourage a 4th visit."
```

### API call sketch
```python
async def generate_analytics_insight(analytics: dict) -> str:
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=200,
        messages=[{"role": "user", "content":
            f"You are a business advisor for a Malaysian auto workshop. "
            f"Write 2–3 actionable insight sentences based on this month's data:\n"
            f"{json.dumps(analytics, indent=2)}"
        }]
    )
    return message.content[0].text.strip()
```

---

## Feature 6 — Multilingual Auto-Translation for Reviews

**Priority:** Low

Customers write reviews in either BM or English. On the workshop detail page, a "Translate" toggle shows Claude-translated versions. Useful for workshop owners who prefer one language.

```python
async def translate_review(text: str, target_lang: str) -> str:
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=200,
        messages=[{"role": "user", "content":
            f"Translate to {'Bahasa Malaysia' if target_lang == 'ms' else 'English'}. "
            f"Keep it natural and short:\n\n{text}"
        }]
    )
    return message.content[0].text.strip()
```

---

## Backend Setup

### Install
```bash
pip install anthropic
```

### Environment
Add to `backend/.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
```

Read in `core/config.py`:
```python
class Settings(BaseSettings):
    ...
    anthropic_api_key: str = ""
```

### New router
Create `backend/routers/ai.py` and register in `main.py`:
```python
from routers import ... ai
app.include_router(ai.router, prefix="/api/v1")
```

### Suggested endpoints
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/ai/suggest-services` | Customer | Symptom → service recommendations |
| POST | `/ai/summarise-reviews/{workshop_id}` | Public | Generate/return cached review summary |
| POST | `/ai/draft-completion/{booking_id}` | Workshop | Auto-draft completion notes |
| GET | `/ai/analytics-insight` | Workshop | Narrative from analytics data |
| POST | `/ai/translate-review` | Any | Translate a review text |
| POST | `/ai/chat` | Customer | General car advice chatbot |

---

## Cost Estimates (Approximate)

| Feature | Model | Est. tokens/call | Calls/day | Est. daily cost |
|---|---|---|---|---|
| Symptom advisor | Haiku | ~500 | 50 | ~$0.04 |
| Review summariser | Haiku | ~800 | 10 | ~$0.01 |
| Completion drafter | Haiku | ~400 | 20 | ~$0.02 |
| Analytics insight | Sonnet | ~600 | 5 | ~$0.02 |
| Chat assistant | Haiku | ~700 | 30 | ~$0.03 |

Total at moderate scale: **< $0.15/day**. Cache review summaries and analytics insights to reduce calls further.

---

## Related Notes
- [[Future Features]] — full planned feature backlog
- [[Backend]] — existing router structure to extend
- [[Features]] — current implementation status
- [[Architecture]] — system overview
