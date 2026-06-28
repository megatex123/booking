# AI Dev Agent — Project Log

---

## 2026-06-28 — Session Summary

### What was built / changed

| Area | Change |
|---|---|
| VTT frontend | Added file upload feature — tab switcher (Rakam / Muat Naik), file picker, drag-zone UI, same `/transcribe` endpoint |
| QR Generator | New standalone app at `qr-generator/` — Flask + Jinja2, port 5002, indigo-on-dark QR codes |
| qrgenerator.percubaan.com | New Cloudflare tunnel subdomain added, DNS CNAME created via CLI |
| investment-agent | Rebuilt with 5 scheduler jobs (was 3): daily_report, hourly_price_alerts, ex_dividend_check, weekly_summary, midnight_snapshot |
| investment-agent | Added notifier.py, obsidian_logger.py, 15-min yfinance cache, graceful shutdown |
| Boot persistence | XDG autostart via `~/.config/autostart/percubaan-services.desktop` + `start-services.sh` |
| ecosystem.config.js | Added qr-generator app entry; investment-agent gets TZ env |
| Telegram | Verified working — user sent /start to bot, `Telegram verified` confirmed in logs |

### All services running (as of 2026-06-28)

| pm2 id | Name | Stack | Port | Status |
|---|---|---|---|---|
| 0 | dashboard | Vite preview (React + Tailwind) | 5173 | ✅ online |
| 1 | voice-model-server | Python Flask | 5555 | ✅ online |
| 3 | vtt-backend | Python Flask | 5000 | ✅ online |
| 4 | investment-agent | Python APScheduler (5 jobs) | — | ✅ online |
| 6 | vtt-frontend | Next.js dev (Pages Router) | 3000 | ✅ online |
| 7 | qr-generator | Python Flask | 5002 | ✅ online |

### All URLs live

| URL | Port | Purpose |
|---|---|---|
| https://voicetotext.percubaan.com | 3000 | VTT web app — record + upload audio, transcription history |
| https://dashboard.percubaan.com | 5173 | AI Dev Agent dashboard — 4-agent workflow orchestration |
| https://api.percubaan.com | 5555 | Voice model inference (`POST /inference`) |
| https://qrgenerator.percubaan.com | 5002 | QR code generator — text/URL → downloadable PNG |

### Outstanding items

- `dashboard/.env` — `VITE_ANTHROPIC_API_KEY` still blank. Set key → `npm run build` → `pm2 restart dashboard`.
- Voice model — no training data yet. Collect `.wav` files + `transcripts.csv`, then run `prepare_data.py`.
- Investment agent — `config.py` holdings have 0 units. Update when first REIT lot purchased.

---

## 2026-06-27 — Week Summary (2026-06-26 → 2026-06-27)

### What was built, day by day

**2026-06-26 — Foundation Sprint**

| Area | Built |
|---|---|
| Dashboard scaffold | Vite + React 18 + Tailwind setup, `src/constants/agents.js`, `src/constants/workflows.js` |
| Dashboard UI | `PulseRing.jsx`, `AgentCard.jsx`, `WorkflowTrack.jsx`, `TaskInput.jsx`, `MemoryPanel.jsx`, `ActivityLog.jsx` |
| Dashboard orchestration | `App.jsx` (full workflow loop, context chaining), `api/claudeAgent.js` (SSE streaming), `utils/telegramNotifier.js`, `utils/obsidianSync.js` |
| Dashboard tests | 46/46 Vitest tests (AgentCard, WorkflowTrack, ActivityLog, App) |
| Voice model pipeline | `config.py`, `prepare_data.py`, `train.py`, `evaluate.py`, `inference.py`, `colab_train.ipynb`, README |
| VTT backend v1 | `database.py` (SQLite), `transcriber.py` (Whisper local), `telegram.py`, Flask routes (`transcribe.py`, `history.py`), `app.py` |
| Investment agent v1 | `main.py`, `scheduler.py` (3 jobs), `fetcher.py`, `portfolio.py`, `alerts.py`, `telegram_utils.py`, `obsidian_sync.py` |

**2026-06-27 — Integration + Frontend Sprint**

| Area | Built / Fixed |
|---|---|
| VTT frontend (JS) | `Waveform.js` (FFT canvas), `Recorder.js` (MediaRecorder state machine) |
| VTT frontend (Next.js) | `Transcription.js`, `History.js`, `pages/index.js`, `pages/_app.js`, full Tailwind setup |
| Backend tests | 52/52 pytest tests (transcribe, history, database) |
| Frontend tests | 40/40 Jest/Testing Library tests (Recorder, Transcription, History) |
| Integration audit | 9 issues found and fixed (see vtt-improvements.md) |
| E2E system test | 6/6 tests passed (backend, history, frontend, dashboard, pm2, Cloudflare) |
| Obsidian API route | `vtt-app/frontend/pages/api/obsidian/append.js` — Next.js server-side fs.appendFileSync |
| VTT 500 fix | `low_cpu_mem_usage=False` in transcriber.py — fixed transformers meta tensor error |
| pm2 vtt-frontend fix | Changed from `script: "npm"` to full node binary path + `interpreter: "none"` + explicit PATH |

### All services (as of 2026-06-27)

| pm2 id | Name | Stack | Port | Status |
|---|---|---|---|---|
| 0 | dashboard | Vite preview (React + Tailwind) | 5173 | ✅ online |
| 1 | voice-model-server | Python Flask | 5555 | ✅ online |
| 3 | vtt-backend | Python Flask | 5000 | ✅ online |
| 4 | investment-agent | Python APScheduler | — | ✅ online |
| 5 | vtt-frontend | Next.js dev (Pages Router) | 3000 | ✅ online |

---

## 2026-06-27 — Full End-to-End System Test

**Agent:** tester — **All tests: 6/6 PASS**

| Test | Endpoint | Result | Notes |
|------|----------|--------|-------|
| 1 | `localhost:5000/health` | ✅ PASS | `status:ok`, model:base (lazy load) |
| 2 | `localhost:5000/api/history` | ✅ PASS | `[]`, empty DB |
| 3 | `localhost:3000` | ✅ PASS | Next.js SSR HTML |
| 4 | `localhost:5173` | ✅ PASS | Dashboard production build |
| 5 | pm2 status | ✅ PASS | 5/5 services online |
| 6a | `api.percubaan.com/health` | ✅ PASS | voice-model 5555 |
| 6b | `voicetotext.percubaan.com` | ✅ PASS | Next.js via tunnel |
| 6c | `dashboard.percubaan.com` | ✅ PASS | Vite build via tunnel |

---

## 2026-06-26 — Investment Monitoring Agent Built

Built `investment-agent/` from scratch. Tracks 3 Malaysian REITs via yfinance, sends Telegram alerts, logs daily snapshots to Obsidian.

**Files:** config.py, telegram_utils.py, fetcher.py (15-min cache), portfolio.py, alerts.py, notifier.py, obsidian_logger.py, scheduler.py (5 jobs), main.py, requirements.txt, .env.example

**Scheduler jobs:**
- `daily_report` — 8:00am MYT weekdays
- `hourly_price_alerts` — 9am–5pm MYT weekdays
- `ex_dividend_check` — Monday 8:00am
- `weekly_summary` — Sunday 8:00am
- `midnight_snapshot` — 00:00 daily

---

## 2026-06-26 — Project Started

- Initialized repo at `/home/penyahpepijat/claude`
- Created CLAUDE.md, memory.md, obsidian vault
- Built 4 subagents: coder, debugger, planner, tester
- Installed cloudflared (v2026.6.1), created tunnel `percubaan-tunnel`
- DNS routed: voicetotext, dashboard, api, qrgenerator subdomains
