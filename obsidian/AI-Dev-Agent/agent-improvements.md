# Agent Improvements

Track improvements, prompt changes, and behavior refinements for each subagent.

---

## planner

### 2026-06-26 → 2026-06-27 — Patterns Learned

**Architecture decisions made:**
- Next.js Pages Router preferred over App Router for this project — no `"use client"` needed, SSR by default, simpler mental model for a small app
- `output: standalone` in `next.config.js` — run with `node .next/standalone/server.js`, separate port from Flask backend
- `Promise.all([import(...)])` inside `useEffect` for browser-only modules (Waveform, Recorder) — avoids SSR crash since `window.AudioContext` / `MediaRecorder` are unavailable on server
- `historyKey` counter pattern — increment on success triggers re-fetch via `useEffect([key])` without exposing setState to child
- `async rewrites()` in `next.config.js` — server-side proxy, eliminates CORS entirely, hides internal port topology from browser

**Key insight — NEXT_PUBLIC env vars are inlined at BUILD TIME in production (`output: standalone`). Changing `.env` requires a rebuild, not just a restart.**

---

## coder

### 2026-06-26 — Dashboard Components

- PulseRing: Tailwind can't JIT arbitrary hex colors in `border-color`. Solution: pass color as string key, map to hex inline via JS object, apply via `style=` prop.
- AgentCard progress bar: dual-mode — `progress > 0` renders determinate `<div style={{width: progress%}}>`, `progress === 0` with `status=working` uses indeterminate CSS keyframe via `.indeterminate-bar` class.
- WorkflowTrack connector: completed step's connector line takes the color of the agent that just finished — makes the pipeline progress obvious without a legend.
- ActivityLog: `slice(-MAX_ENTRIES)` before render, not during state update. No trimming needed — max 60 entries in DOM.

### 2026-06-26 — Voice Model Pipeline

- `inference.py` uses module-level singletons (`_model`, `_processor`, `_device`) — model loads once, safe for Flask import without hot-reload risk.
- `config.py` derives `BASE_DIR` from `os.path.abspath(__file__)` — paths work regardless of where `python` is invoked.
- `train.py`: `model.config.forced_decoder_ids` + `suppress_tokens=[]` forces Malay decoding, disables Whisper's auto language detection.
- `DataCollatorSpeechSeq2SeqWithPadding`: replace padding token ids with `-100` so cross-entropy ignores them; strip leading BOS if present.
- `greater_is_better=False` when `metric_for_best_model='wer'` — lower WER is better, this is easy to forget.

### 2026-06-27 — VTT Backend

- Flask blueprint prefix `/api` applies to ALL routes in the blueprint — route decorators use relative paths (`/transcribe` not `/api/transcribe`).
- Temp file cleanup goes in `finally:` block, not inside the happy path — ensures cleanup even on transcription error.
- `ORDER BY id DESC` not `timestamp DESC` — `CURRENT_TIMESTAMP` has 1-second granularity; same-second inserts sort non-deterministically by timestamp.
- `contextmanager` `_conn()` pattern for SQLite — auto-commit + auto-close, no forgotten `conn.close()`.

### 2026-06-27 — VTT Frontend (Next.js)

- Transcription fade-in: `useEffect` keyed on `result?.id` resets `opacity: 0` then `setTimeout(→1, 20ms)`. Keyed on ID so the animation re-fires for each new result.
- History pagination: `PAGE_SIZE = 10` slice, prev/next buttons. No library needed for this scale.
- Delete: optimistic filter from state immediately, no refetch — keeps UX snappy.
- `toLocaleString('ms-MY', ...)` for Malay date format with fallback for invalid timestamps.

---

## debugger

### 2026-06-27 — Integration Audit (9 issues found and fixed)

**Patterns discovered:**

1. **`NEXT_PUBLIC_API_URL` pointed at wrong service** — frontend was calling voice-model server (port 5555, only has `/inference`) instead of vtt-backend (port 5000, has all the REST API). Always trace the full chain: browser URL → cloudflared → local port → Flask route.

2. **No proxy between Next.js and Flask** — frontend made direct cross-origin calls. Fix: `async rewrites()` in `next.config.js` as a server-side proxy. Result: same-origin from browser's perspective, no CORS headers needed on Flask.

3. **Vite dev mode CSS fails through Cloudflare tunnel** — Vite dev mode injects CSS via JavaScript (`__vite__updateStyle()`). The JS injection silently fails through the tunnel proxy. Fix: `vite preview` (production build) serves CSS as real `<link rel="stylesheet">` that works through any proxy.

4. **cloudflared doesn't support SIGHUP** — sends exit code 129. Must use full kill + restart: `kill <pid> && cloudflared tunnel run <name> &`.

5. **Two cloudflared configs** — `~/.cloudflared/config.yml` (ACTIVE, used by running process) vs `/etc/cloudflared/config.yml` (inactive system copy). Always check which process is actually running: `ps aux | grep cloudflared` → look at `--config` flag.

6. **`VITE_*` vars inlined at build time** — creating `.env` without rebuilding has no effect. Must run `npm run build` after any `.env` change for dashboard.

7. **`.ogg` missing from ALLOWED_EXTENSIONS** — Firefox records in ogg/opus format. Always include `.ogg` alongside `.webm` for browser audio recording.

8. **Obsidian sync endpoint did not exist** — no HTTP server had `/obsidian/append`. Solution: Next.js API route (`pages/api/obsidian/append.js`) that runs server-side, uses `fs.appendFileSync` directly. Cleaner than adding a Flask route.

9. **pm2 `restart` with ecosystem.config.js change** — pm2's own env block isn't updated unless `--update-env` is passed. But app `.env` files ARE re-read on startup via python-dotenv. Not an error — just a warning to understand.

**Common fixes applied:**
- `dashboard/.env` created (was missing) with Telegram creds + VITE_BACKEND_URL
- `vtt-app/backend/.env` Telegram creds filled in (was empty)
- `~/.cloudflared/config.yml` corrected: `voicetotext → localhost:3000` (was 5000)
- `claudeAgent.js` MAX_TOKENS: 1000 → 4096
- `obsidianSync.js` default URL and endpoint path corrected

---

## tester

### 2026-06-27 — Test Suites (52 backend + 40 frontend + 6 E2E)

**Patterns discovered:**

**Backend testing (pytest):**
- Mock ML packages at module level in `conftest.py` via `sys.modules` BEFORE importing anything that touches them — `torch`, `transformers`, `librosa`, `soundfile`, `numpy` all need to be in `sys.modules` before `transcriber` is imported.
- Functions imported with `from module import func` create a LOCAL binding in the importer. Must patch `routes.transcribe.notify_transcription_done`, NOT `telegram.notify_transcription_done`.
- Each test gets a fresh SQLite DB via `tmp_path` fixture + `monkeypatch.setattr(database, 'DB_PATH', str(tmp_path / 'test.db'))`.

**Frontend testing (Jest + Testing Library):**
- `@testing-library/jest-dom` imported directly in each test file — no `setupFilesAfterFramework` config needed.
- Recorder tests: `jest.requireMock()` in `beforeEach` to configure mock implementation per test (not per jest.mock call).
- `await act(async () => { render(<Component />) })` — flushes dynamic imports and async effects in one go.
- `Object.defineProperty(navigator, 'clipboard', { value: {...}, configurable: true })` in beforeEach for clipboard tests.
- `jest.useFakeTimers()` + `jest.runAllTimers()` for copy button feedback (1.5s timeout).
- Canvas mock: `HTMLCanvasElement.prototype.getContext = () => ({ clearRect, fillRect, ... })` in `beforeAll`.
- `expect.stringContaining('/history/1')` over exact URL match — decouples test from URL prefix changes.

**E2E test (2026-06-27 — 6/6 pass):**
- TEST 2 note: `localhost:5000/history` returns 404 (Flask blueprints have `/api` prefix). Correct direct path is `/api/history`. The Next.js proxy at port 3000 handles the translation: `GET /history` → `GET :5000/api/history`.
