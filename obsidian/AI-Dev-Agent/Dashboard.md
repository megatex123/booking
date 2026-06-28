# Dashboard

Central overview of the AI-Dev-Agent project.

## Quick Links
- [[project-log]] — Full project history
- [[memory]] — Patterns, bugs, decisions, things to avoid
- [[agent-improvements]] — Per-agent refinements
- [[model-improvements]] — Voice model training progress
- [[vtt-improvements]] — Voice-to-text improvements
- [[dashboard-improvements]] — Dashboard UI/data updates
- [[investment-log]] — Investment agent log

---

## Project Status — 2026-06-28

| Component | Status | URL / Location |
|---|---|---|
| Agent team (4 agents) | ✅ Running | dashboard.percubaan.com |
| Dashboard | ✅ Live | https://dashboard.percubaan.com |
| VTT App | ✅ Live | https://voicetotext.percubaan.com |
| QR Generator | ✅ Live | https://qrgenerator.percubaan.com |
| Flask API (voice-model) | ✅ Live | https://api.percubaan.com |
| Cloudflare Tunnel | ✅ Active | percubaan-tunnel (b5fdaa0f) |
| PM2 | ✅ All 6 services managed | `pm2 status` |
| Telegram notifications | ✅ Verified | Bot: 8883581722, Chat: 8520958438 |
| Boot persistence | ✅ Active | XDG autostart (~/.config/autostart/) |
| Voice Model pipeline | 🔄 Ready | Awaiting training data |
| Investment Agent | ✅ Running | APScheduler 5 jobs, Telegram verified |

---

## Services

| pm2 id | Service | URL | Local Port | pm2 name |
|---|---|---|---|---|
| 0 | Dashboard (Vite) | https://dashboard.percubaan.com | 5173 | dashboard |
| 1 | Voice Model (Flask) | https://api.percubaan.com | 5555 | voice-model-server |
| 3 | VTT Backend (Flask) | — internal — | 5000 | vtt-backend |
| 4 | Investment Agent | — no HTTP — | — | investment-agent |
| 6 | VTT App (Next.js) | https://voicetotext.percubaan.com | 3000 | vtt-frontend |
| 7 | QR Generator (Flask) | https://qrgenerator.percubaan.com | 5002 | qr-generator |

---

## Tunnel

- Name: `percubaan-tunnel`
- ID: `b5fdaa0f-2210-403e-b2dd-bd63c1b5a1cd`
- Config: `~/.cloudflared/config.yml`
- Binary: `~/.local/bin/cloudflared`

### Subdomain → Port Map

| Subdomain | Port | Service |
|---|---|---|
| voicetotext.percubaan.com | 3000 | vtt-frontend (Next.js) |
| dashboard.percubaan.com | 5173 | dashboard (Vite preview) |
| api.percubaan.com | 5555 | voice-model-server (Flask) |
| qrgenerator.percubaan.com | 5002 | qr-generator (Flask) |

---

## Agents

| Agent | Role | System prompt focus |
|---|---|---|
| planner | Task breakdown and architecture | Decompose, plan, estimate, no code |
| coder | Feature implementation | Write clean code, tests, follow conventions |
| debugger | Bug diagnosis and fixes | Find root cause, minimal fix, explain why |
| tester | Tests and validation | Coverage, edge cases, integration checks |

---

## Pending Actions

1. **Anthropic API Key** — Fill `VITE_ANTHROPIC_API_KEY=sk-ant-...` in `dashboard/.env`, then:
   ```bash
   cd /home/penyahpepijat/claude/dashboard && npm run build && pm2 restart dashboard
   ```

2. **Voice model training data** — Add `.wav` files to `voice-model/data/audio/`, update `transcripts.csv`:
   ```bash
   python voice-model/src/prepare_data.py
   python voice-model/src/train.py
   ```

3. **Investment agent holdings** — Update `investment-agent/config.py` with real unit quantities and avg_price when first REIT lot is purchased.
