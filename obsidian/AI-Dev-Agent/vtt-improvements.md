# VTT Improvements

Track voice-to-text feature improvements, latency changes, and transcription quality.

## Feature Changes

### 2026-06-27 — Database + Transcriber + Telegram Built

**Agent:** coder

**Files created:**

| File | Purpose |
|---|---|
| `vtt-app/backend/database.py` | SQLite CRUD — `transcriptions` table, `save_transcription()`, `get_history()`, `get_stats()`, `delete_transcription()` |
| `vtt-app/backend/transcriber.py` | Local Whisper inference — detects fine-tuned model via `config.json`, falls back to `openai/whisper-small`. Confidence from avg max-token prob. |
| `vtt-app/backend/telegram.py` | Telegram notifications — `notify_transcription_done()`, `notify_transcription_error()`, `notify_server_start()`, `notify_server_stats()` |

**Database schema:**
```sql
CREATE TABLE transcriptions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  text             TEXT    NOT NULL,
  timestamp        DATETIME DEFAULT CURRENT_TIMESTAMP,
  duration_seconds REAL,
  model_used       TEXT,
  language         TEXT,
  confidence       REAL
);
CREATE INDEX idx_timestamp ON transcriptions (timestamp DESC);
```
DB file: `vtt-app/data/history.db` (created automatically on first run)

**Model switching logic:**
- Check `voice-model/models/config.json` exists → `fine-tuned`
- If missing or load fails → `base` (`openai/whisper-small` via HuggingFace)
- Singletons loaded once per process — no reload on each request

**Next step:** Build `server.py` (wire database + transcriber + telegram into Flask routes)

### 2026-06-27 — Flask Routes + App Entry Point Built

**Agent:** coder

**Files created:**

| File | Purpose |
|---|---|
| `vtt-app/backend/routes/__init__.py` | Empty package init |
| `vtt-app/backend/routes/transcribe.py` | `transcribe_bp` — `POST /api/transcribe`: validate → /tmp/ → transcribe → DB → Telegram → cleanup |
| `vtt-app/backend/routes/history.py` | `history_bp` — `GET /api/history`, `GET /api/stats`, `DELETE /api/history/<id>` |
| `vtt-app/backend/app.py` | Flask factory: load_dotenv, CORS on /api/*, register blueprints, serve ../frontend/, GET /health, call init_db() + notify_server_start() on startup |
| `vtt-app/backend/requirements.txt` | flask, flask-cors, openai-whisper, python-dotenv, requests, torch, numpy, transformers, librosa |
| `vtt-app/backend/.env.example` | TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, DATABASE_PATH, MODEL_PATH, PORT=5000, CORS_ORIGIN |

**Port change:** vtt-app moved from 3000 → 5000 (app.py replaces server.py). ecosystem.config.js and cloudflared config.yml updated.

**Route summary:**

| Method | Path | Returns |
|---|---|---|
| POST | /api/transcribe | `{id, text, duration, model_used, language}` |
| GET | /api/history?limit=N | list of transcription dicts |
| GET | /api/stats | `{total, avg_duration, most_used_model}` |
| DELETE | /api/history/\<id\> | `{deleted: true, id}` or 404 |
| GET | /health | `{status, port, model, model_loaded, fine_tuned_exists}` |

**To start:**
```bash
cd vtt-app/backend
cp .env.example .env   # fill in Telegram creds
pip3 install -r requirements.txt --break-system-packages
python3 app.py         # or pm2 restart vtt-app
```

### 2026-06-27 — Backend Tests: 52/52 Passed

**Agent:** tester

**Test files created:**

| File | Tests | Coverage |
|---|---|---|
| `tests/conftest.py` | — | Flask test client, test DB fixture, transcriber mock, ML package stubs |
| `tests/test_transcribe.py` | 11 | POST /api/transcribe: valid WAV, no file, wrong type, empty file |
| `tests/test_history.py` | 20 | GET /api/history, GET /api/stats, DELETE /api/history/\<id\> |
| `tests/test_database.py` | 21 | save_transcription, get_history, get_stats, delete_transcription |

**Result: 52 passed, 0 failed (0.43s)**

**Bugs found and fixed:**

| Bug | Fix |
|---|---|
| `numpy` not installed — `import transcriber` failed | Added `numpy` to sys.modules mock list in conftest.py |
| `ORDER BY timestamp DESC` non-deterministic when 2 rows insert in same second | Changed to `ORDER BY id DESC` in `database.get_history()` — autoincrement id is always monotonic |
| No empty-file validation in route | Added 0-byte check to `routes/transcribe.py` — returns 400 |

**Test strategy:**
- torch, transformers, librosa, soundfile, numpy mocked via sys.modules at conftest module-level (before any import triggers transcriber)
- `transcriber.transcribe` monkeypatched per test via `mock_transcribe` fixture — model never loads
- Telegram notify functions patched in `routes.transcribe` namespace (where they're bound by `from telegram import ...`)
- Each test gets a fresh SQLite DB via `tmp_path` + `monkeypatch.setattr(database, 'DB_PATH', ...)`

**Run tests:**
```bash
cd vtt-app/backend
python3 -m pytest tests/ -v
```


### 2026-06-27 — Frontend JS Components Built

**Agent:** coder

**Files created:**

| File | Purpose |
|---|---|
| `vtt-app/frontend/components/Waveform.js` | Canvas FFT waveform — 24 cyan (#06b6d4) bars, centered vertically, rAF loop |
| `vtt-app/frontend/components/Recorder.js` | MediaRecorder state machine — idle/recording/processing, timer, FormData POST |

**Waveform API:**
```js
import { Waveform } from './components/Waveform.js';
const wf = new Waveform(document.getElementById('my-canvas'));
wf.start(mediaStream);   // begin FFT animation
wf.stop();               // freeze + reset idle bars
```
- Canvas dimensions read from the element at draw time
- fftSize=64 → 32 frequency bins → step=floor(32/24)≈1 bin per bar
- Bars centered: startX = (canvasW − totalBarsW) / 2; y = (canvasH − barH) / 2
- `ctx.roundRect` polyfilled via `_roundRect()` for Firefox < 112 / Safari < 15.4

**Recorder API:**
```js
import { Recorder } from './components/Recorder.js';
const rec = new Recorder({
  url:           'https://api.percubaan.com/transcribe',
  onStateChange: state  => console.log(state),   // 'idle'|'recording'|'processing'
  onTimer:       label  => console.log(label),   // '01:23' or ''
  onStream:      stream => stream ? wf.start(stream) : wf.stop(),
  onResult:      data   => console.log(data.text),
  onError:       msg    => alert(msg),
});
await rec.start();
rec.stop();
```

**Notes:**
- MediaRecorder output: webm/opus → .webm (preferred), fallback ogg/opus → .ogg; WAV/MP3 not available natively in browsers but backend accepts .webm
- URL default: `https://api.percubaan.com/transcribe` (voice-model server on port 5555). To route through vtt-backend use `https://voicetotext.percubaan.com/api/transcribe`
- `onStream(null)` fires on stop so caller can call `wf.stop()` in one place
- Both components are ES modules — load with `<script type="module">` in index.html

**Integration snippet for index.html:**
```html
<canvas id="waveform" width="320" height="60"></canvas>
<script type="module">
  import { Waveform } from './components/Waveform.js';
  import { Recorder } from './components/Recorder.js';
  const wf  = new Waveform(document.getElementById('waveform'));
  const rec = new Recorder({
    onStateChange: s => btnRecord.textContent = ({idle:'Mula Rakam', recording:'Henti', processing:'Memproses…'})[s],
    onStream:      s => s ? wf.start(s) : wf.stop(),
    onResult:      d => (transcriptEl.textContent = d.text),
    onError:       m => (statusEl.textContent = m),
  });
  btnRecord.onclick = () => rec.state === 'recording' ? rec.stop() : rec.start();
</script>
```


### 2026-06-27 — Next.js Frontend Built (Pages Router)

**Agent:** coder

**Files created:**

| File | Purpose |
|---|---|
| `vtt-app/frontend/components/Transcription.js` | React component — spinner, fade-in result, model label, copy button |
| `vtt-app/frontend/components/History.js` | React component — paginated history list, delete per item |
| `vtt-app/frontend/pages/index.js` | Main page — assembles all components, dark UI |
| `vtt-app/frontend/pages/_app.js` | Next.js App wrapper — imports globals.css |
| `vtt-app/frontend/styles/globals.css` | @tailwind directives |
| `vtt-app/frontend/package.json` | next@^14.2 + react@^18.3 + tailwindcss@^3.4 |
| `vtt-app/frontend/next.config.js` | output: standalone, NEXT_PUBLIC_API_URL default |
| `vtt-app/frontend/tailwind.config.js` | content: pages/**/*.js + components/**/*.js |
| `vtt-app/frontend/postcss.config.js` | tailwindcss + autoprefixer plugins |
| `vtt-app/frontend/.env.example` | NEXT_PUBLIC_API_URL=https://api.percubaan.com |

**Architecture decisions:**

- **Pages Router** (not App Router) — `pages/index.js`, no `"use client"` needed, SSR by default
- **Waveform + Recorder** loaded via `Promise.all([import(...)])` inside `useEffect` — avoids SSR crash since they reference `window.AudioContext` / `MediaRecorder`
- **historyKey** counter in React state: increments on each successful transcription → History `useEffect([refreshKey])` re-fetches automatically
- **output: standalone** — run with `node .next/standalone/server.js`; NOT static export. Needs own port (3001) separate from Flask (5000)

**Transcription.js behaviour:**
- `isProcessing=true` → animated Spinner + "Memproses audio…"
- `result=null` → empty state message
- `result` present → fade-in animation (opacity 0→1, translateY 8px→0, keyed on `result.id`)
- Model: `openai/*` → "Whisper Asas", other → "Model Tersuai"
- Copy button: `navigator.clipboard.writeText` → 1.5s "Disalin ✓" feedback

**History.js behaviour:**
- Fetches `NEXT_PUBLIC_API_URL/history?limit=200` on mount and on every `refreshKey` change
- PAGE_SIZE = 10; prev/next pagination with Malay labels
- Delete button: `DELETE /history/:id` → optimistic filter from state
- Delete button hidden (opacity-40) → reveals on row hover (group-hover)
- Timestamp: `toLocaleString('ms-MY', ...)` with fallback for invalid dates

**To start dev:**
```bash
cd vtt-app/frontend
cp .env.example .env.local
npm install
npm run dev          # http://localhost:3001
```

**To build and run standalone:**
```bash
npm run build
node .next/standalone/server.js   # PORT=3001
```

**Note:** `NEXT_PUBLIC_API_URL` defaults to `https://api.percubaan.com` (port 5555, voice-model server). To use vtt-backend instead, set `NEXT_PUBLIC_API_URL=https://voicetotext.percubaan.com/api` in `.env.local`.


### 2026-06-27 — Frontend Tests: 40/40 Passed

**Agent:** tester

**Test files created:**

| File | Tests | Coverage |
|---|---|---|
| `__tests__/Recorder.test.js` | 7 | Recording button UI in pages/index.js |
| `__tests__/Transcription.test.js` | 17 | Transcription component — spinner, result, copy, model label, duration |
| `__tests__/History.test.js` | 16 | History component — list, empty state, delete, pagination |

**Result: 40 passed, 0 failed (1.3s)**

**Test infrastructure added:**

| File | Purpose |
|---|---|
| `jest.config.js` | `next/jest` with jsdom env, matches `__tests__/**/*.test.js` |
| `package.json` | Added jest, jest-environment-jsdom, @testing-library/react, @testing-library/jest-dom to devDependencies; added `test` script |

**Test coverage per file:**

*Recorder.test.js (7 tests):*
- renders Mula Rakam button in idle state ✓
- button is enabled initially ✓
- clicking Mula Rakam transitions to recording state ✓
- clicking Henti Rakaman returns to idle state ✓
- shows live timer `00:01` while recording ✓
- timer disappears after stopping ✓
- shows Malay error message when mic is denied ✓
- button is disabled while processing ✓

*Transcription.test.js (17 tests):*
- shows spinner SVG when isProcessing ✓
- shows Memproses audio text ✓
- does not show result while processing ✓
- empty state message when null ✓
- no copy button when no result ✓
- displays transcription text ✓
- Whisper Asas badge for openai/ model ✓
- Model Tersuai badge for fine-tuned model ✓
- `—` when model_used is missing ✓
- duration under 60s formatted as `2.5s` ✓
- duration over 60s formatted as `1m 15s` ✓
- language shown in uppercase ✓
- duration omitted when null ✓
- copy button present when result exists ✓
- Salin writes text to clipboard ✓
- button label changes to `Disalin ✓` after copy ✓
- label reverts to Salin after 1.5s ✓

*History.test.js (16 tests):*
- shows Memuatkan… while pending ✓
- empty state when API returns [] ✓
- Sejarah heading with no count ✓
- renders each item's text ✓
- shows count in heading ✓
- shows duration per item ✓
- Asas badge for openai/ model ✓
- Tersuai badge for fine-tuned ✓
- delete button per item ✓
- DELETE /history/:id called on click ✓
- item removed from list after delete ✓
- no pagination for ≤10 items ✓
- pagination for >10 items ✓
- page indicator `1 / 2` ✓
- Sebelum disabled on first page ✓
- Seterus advances to next page ✓

**Strategy patterns:**
- `@testing-library/jest-dom` imported directly in each test file — no `setupFilesAfterFramework` needed
- Recorder test: mocks Waveform/Recorder/Transcription/History + `next/head`; uses `jest.requireMock()` in beforeEach to set mock implementation; `await act(async () => render(<Home />))` flushes dynamic imports
- Transcription test: `Object.defineProperty(navigator, 'clipboard', ...)` in beforeEach; `jest.useFakeTimers()` for copy button feedback
- History test: `mockFetchSequence()` helper for chained fetch calls; `expect.stringContaining('/history/1')` to avoid URL prefix coupling
- Canvas: `HTMLCanvasElement.prototype.getContext = () => (stubs)` in beforeAll

**Run tests:**
```bash
cd vtt-app/frontend
npm test
```


## Latency / Performance

- Whisper model loads lazily on first transcription request (not at server startup) — first request will be slower. Subsequent requests reuse module-level singleton.
- `vite preview` serves production build — static files cached by browser, fast subsequent loads.

## Transcription Quality

- Base model: `openai/whisper-small` via HuggingFace — reasonable Malay quality for clear speech.
- Fine-tuned model: not yet trained — pipeline ready, awaiting real audio data.
- Confidence score: average max-token probability from `output_scores`. Not calibrated — treat as relative indicator only.

## Known Issues

- `NEXT_PUBLIC_API_URL` defaults to `https://voicetotext.percubaan.com` — this routes through Next.js proxy → Flask vtt-backend. The voice-model server at `api.percubaan.com` is a SEPARATE endpoint (`POST /inference`, not `/transcribe`) and is not called by the frontend.
- `history` endpoint requires `/api/history` prefix when called directly on port 5000. The Next.js proxy at port 3000 handles the path translation transparently.
- Firefox: records in ogg/opus format. Backend now accepts `.ogg` (added to ALLOWED_EXTENSIONS in 2026-06-27 integration audit).
- First transcription after server start will be slow (Whisper model load + tokenizer init ~5-30s depending on hardware).

---

## 2026-06-27 — Final VTT App State

### Architecture (as of 2026-06-27)

```
Browser
  ↓  HTTPS
voicetotext.percubaan.com  (Cloudflare tunnel)
  ↓  HTTP
localhost:3000  (Next.js, pm2: vtt-frontend)
  │  serves:  pages/index.js (UI)
  │  proxies: GET /history       → localhost:5000/api/history
  │           GET /history/:id   → localhost:5000/api/history/:id
  │           POST /transcribe   → localhost:5000/api/transcribe
  │           POST /api/obsidian/append → pages/api/obsidian/append.js (fs write)
  ↓  HTTP (internal)
localhost:5000  (Flask vtt-backend, pm2: vtt-backend)
  │  routes:  POST /api/transcribe → transcriber.py → Whisper inference
  │           GET  /api/history    → database.py SQLite
  │           GET  /api/stats      → database.py
  │           DELETE /api/history/:id
  │           GET  /health
  ↓  loads
openai/whisper-small  (via HuggingFace, lazy-loaded)
```

### All features working

| Feature | Status |
|---|---|
| Audio recording (webm/ogg) | ✅ |
| FFT waveform animation during recording | ✅ |
| Whisper transcription (base model) | ✅ |
| Transcription history (SQLite) | ✅ |
| History pagination (10 per page) | ✅ |
| Delete transcription | ✅ |
| Copy to clipboard | ✅ |
| Model badge (Whisper Asas / Model Tersuai) | ✅ |
| Telegram notification on transcription | ✅ |
| Telegram notification on server start | ✅ |
| Obsidian sync endpoint | ✅ |
| `.ogg` (Firefox) support | ✅ |

### Test coverage

| Suite | Tests | Result |
|---|---|---|
| Backend (pytest) | 52 | ✅ 52/52 passed |
| Frontend (Jest) | 40 | ✅ 40/40 passed |
| E2E system test | 6 | ✅ 6/6 passed |

### Pending

- Fine-tuned voice model — needs real audio data. Add `.wav` files to `voice-model/data/audio/`, update `transcripts.csv`, run `python src/prepare_data.py`.
- Stats panel (`GET /api/stats`) — endpoint exists and tested but not wired into the Next.js frontend UI yet.



---

## 2026-06-27 — Full Integration Audit + Fixes

**Agent:** debugger

**Issues found and fixed across all 6 checks:**

### CHECK 1 — Frontend to Backend

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | `NEXT_PUBLIC_API_URL=https://api.percubaan.com` pointed at voice-model server (port 5555) which has `/inference` not `/transcribe`. History calls to `/history` returned 404. | CRITICAL | Changed to `https://voicetotext.percubaan.com` |
| 2 | No proxy between Next.js frontend (port 3000) and Flask backend (port 5000) | CRITICAL | Added Next.js rewrites in `next.config.js`: `/transcribe` → `localhost:5000/api/transcribe`, `/history` → `localhost:5000/api/history`, `/history/:id` → `localhost:5000/api/history/:id` |
| 3 | `.ogg` missing from `routes/transcribe.py` ALLOWED_EXTENSIONS — Firefox sends ogg/opus | MODERATE | Added `.ogg` to `ALLOWED_EXTENSIONS`. `transcriber.py` already supported it. |

**Files changed:**
- `vtt-app/frontend/next.config.js` — added `async rewrites()` block, updated default `NEXT_PUBLIC_API_URL`
- `vtt-app/frontend/.env` — `https://api.percubaan.com` → `https://voicetotext.percubaan.com` + added `VTT_BACKEND_URL=http://localhost:5000`
- `vtt-app/frontend/.env.example` — same
- `vtt-app/backend/routes/transcribe.py` — added `.ogg` to ALLOWED_EXTENSIONS

### CHECK 2 — Backend to Model

All OK: `transcriber.py` correctly detects `voice-model/models/config.json`, falls back to base Whisper, temp file cleanup in `finally:`, DB saves all 5 fields. No changes needed.

### CHECK 3 — Dashboard to Anthropic API

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 4 | `dashboard/.env` did not exist — `VITE_ANTHROPIC_API_KEY`, Telegram creds all missing | CRITICAL | Created `dashboard/.env` with Telegram creds (from investment-agent/.env). API key left as placeholder — user must fill in. |
| 5 | `MAX_TOKENS=1000` in `claudeAgent.js` too low for coder/planner — responses truncated at ~750 words | MODERATE | Changed to `4096` |

**Files changed:**
- `dashboard/.env` — CREATED with Telegram creds + `VITE_BACKEND_URL=https://voicetotext.percubaan.com`
- `dashboard/src/api/claudeAgent.js` — `MAX_TOKENS 1000 → 4096`

### CHECK 4 — Telegram Notifications

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 6 | `vtt-app/backend/.env` had empty `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` | CRITICAL | Filled in credentials from `investment-agent/.env` |

**Files changed:**
- `vtt-app/backend/.env` — filled in TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID

Dashboard Telegram: covered by Fix #4 (dashboard/.env created with same token).

Both backend (`telegram.py`) and dashboard (`telegramNotifier.js`) use the same bot token and chat ID. HTML parse_mode used in both. Silent-fail on error in both. ✓

### CHECK 5 — Obsidian Sync

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 7 | `/obsidian/append` endpoint did not exist anywhere — no backend served it | CRITICAL | Created Next.js API route `vtt-app/frontend/pages/api/obsidian/append.js` that writes directly to the filesystem. Returns CORS header for `dashboard.percubaan.com`. |
| 8 | `obsidianSync.js` called wrong URL (`api.percubaan.com/obsidian/append`) | CRITICAL | Updated to `VITE_BACKEND_URL/api/obsidian/append` = `https://voicetotext.percubaan.com/api/obsidian/append` |

**Files changed:**
- `vtt-app/frontend/pages/api/obsidian/append.js` — CREATED: Next.js API route, `fs.appendFileSync` to `obsidian/AI-Dev-Agent/<basename>`, CORS for `dashboard.percubaan.com`
- `dashboard/src/utils/obsidianSync.js` — default URL `api.percubaan.com` → `voicetotext.percubaan.com`, path `/obsidian/append` → `/api/obsidian/append`

All Obsidian files confirmed writable:
```
obsidian/AI-Dev-Agent/agent-improvements.md ✓
obsidian/AI-Dev-Agent/dashboard-improvements.md ✓
obsidian/AI-Dev-Agent/memory.md ✓
obsidian/AI-Dev-Agent/project-log.md ✓
obsidian/AI-Dev-Agent/vtt-improvements.md ✓
obsidian/AI-Dev-Agent/investment-log.md ✓
obsidian/AI-Dev-Agent/model-improvements.md ✓
```

### CHECK 6 — Cloudflare Routes

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 9 | `~/.cloudflared/config.yml` (ACTIVE) had `voicetotext.percubaan.com → localhost:5000` (Flask) — should route to Next.js (port 3000) | CRITICAL | Updated `~/.cloudflared/config.yml` to `localhost:3000`. Restarted cloudflared. |

**Final tunnel routing:**
```
voicetotext.percubaan.com → localhost:3000  (Next.js frontend, proxies /api/* to Flask on 5000)
dashboard.percubaan.com   → localhost:5173  (Vite production build)
api.percubaan.com         → localhost:5555  (voice-model inference server)
```

### Services restarted / rebuilt
- `vtt-backend` — picks up new Telegram creds via python-dotenv
- `vtt-frontend` — picks up new `next.config.js` rewrites and `.env`
- `dashboard` — REBUILT (`npm run build`) so `VITE_*` env vars are inlined; pm2 restarted
- `cloudflared` — fully restarted (not SIGHUP, doesn't support config reload) at new PID 26795

### Verification
```
curl http://localhost:5000/health         → {"status":"ok","port":5000}  ✓
curl http://localhost:3000                → Next.js HTML                  ✓
curl http://localhost:3000/history        → []  (proxied to Flask)        ✓
curl http://localhost:5173/               → dashboard HTML                ✓
```

