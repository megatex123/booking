# memory.md

## Patterns Learned
- Dashboard uses Vite + React 18 + Tailwind (no extra UI libs). Entry: `src/main.jsx`, styles: `src/index.css` with `@tailwind` directives.
- Constants split into `src/constants/agents.js` and `src/constants/workflows.js` — import separately to keep components clean.
- PulseRing uses dual-ring technique (two rings offset by 0.5s) for smooth depth effect. Color passed as string key (blue/green/red/purple) mapped to hex — Tailwind can't JIT arbitrary border-color hex values.
- AgentCard progress bar: `progress > 0` shows determinate bar, `progress === 0` with status=working shows indeterminate CSS animation via `.indeterminate-bar` class.
- WorkflowTrack connector line color follows the completed agent's color — makes progress visually obvious at a glance.
- ActivityLog caps at 60 entries via `slice(-MAX_ENTRIES)` before render — no state trimming needed.
- MemoryPanel parses raw memory.md text by scanning for `## Section` headings — keeps it decoupled from any file-read API.
- TaskInput: Ctrl+Enter submits; Run button disabled when `!task.trim() || isRunning`.
- Telegram utils use `parse_mode: HTML` — bold with `<b>`, code with `<code>`. Errors are swallowed silently (non-critical).
- obsidianSync maps agentId → Obsidian file via `OBSIDIAN_FILE_MAP`. Unknown agents fall back to `project-log.md`. Backend endpoint: `POST /obsidian/append` with `{ file, content }`.
- claudeAgent.js uses SSE streaming: reads `data:` lines, parses `content_block_delta` events, calls `onChunk(text)` per delta. Requires `anthropic-dangerous-direct-browser-access: true` header for browser direct calls.
- App.jsx workflow loop: agents not in current workflow stay idle; upcoming agents get `queued` status with position badge. Previous agent output is passed as context to the next agent's user message.
- Shared memory grows by appending `[timestamp] AgentName: output_preview` after each agent completes. Stored in React state — not persisted between page loads (backend sync handles persistence).
- Vite dev server bound to `0.0.0.0:5173` so cloudflared tunnel can reach it.


## Bugs Fixed
- `ActivityLog.jsx`: `scrollIntoView` not implemented in jsdom — guard with `typeof scrollIntoView === 'function'` before calling. No effect in real browser.

## Decisions Made
- No extra UI libraries in dashboard — React + Tailwind only, keeps bundle small and avoids version conflicts.
- `VITE_BACKEND_URL` defaults to `https://api.percubaan.com` in `.env.example`.
- Voice model: fine-tune `openai/whisper-small` (or whisper-base for Colab free tier) for STT; Coqui TTS for synthesis.
- prepare_data.py uses `librosa.load(sr=16000, mono=True)` then peak-normalises to [-1,1]. Clips > 30s are dropped (Whisper hard limit).
- HuggingFace DatasetDict saved to `voice-model/data/processed/` with `dataset.save_to_disk()`. Cast audio column with `Audio(sampling_rate=16000)`.
- config.py uses `os.path.abspath(__file__)` to derive BASE_DIR — paths work regardless of cwd.
- transcripts.csv columns: `filename, text` — filename is just the basename (e.g. sample_001.wav), not a full path.
- Language set to `ms` (Malay) for Whisper — affects tokenizer and decoding.
- train.py: set `model.config.forced_decoder_ids` + `suppress_tokens=[]` to force Malay decoding and disable auto language detection.
- DataCollatorSpeechSeq2SeqWithPadding: replace padding token ids with -100 so Seq2SeqTrainer ignores them in cross-entropy loss. Strip leading BOS token if present.
- `greater_is_better=False` in Seq2SeqTrainingArguments when `metric_for_best_model='wer'` — lower WER is better.
- evaluate.py uses `jiwer.Compose` pipeline (lowercase, strip punctuation, collapse spaces) before WER — prevents false penalties from punctuation differences.
- evaluate.py saves per-sample + aggregate results to `voice-model/results.json` with timestamp.
- inference.py uses module-level singletons (`_model`, `_processor`, `_device`) so model loads once and is reused across calls — safe for Flask import.
- inference.py falls back to `openai/whisper-small` base if `OUTPUT_DIR` is empty or missing — no crash on first run before training.
- Colab notebook patches `config.*` paths at runtime so all scripts work with `/content/voice-model/` local paths without editing source files.
- Voice model full pipeline status: COMPLETE. Next step: collect audio data and run prepare_data.py.
- Training on Google Colab — dataset + checkpoints synced via Google Drive (drive_sync.py). GOOGLE_DRIVE_FOLDER_ID in .env.
- Whisper hard limit: audio segments must be ≤ 30s — preprocess.py enforces this before training.
- Inference exposed as Flask endpoint: `POST /transcribe` — consumed by vtt-app/backend.
- vtt-app CURRENT architecture: Next.js frontend (port 3000) + Flask backend (port 5000) are separate services. Next.js rewrites proxy /transcribe → localhost:5000/api/transcribe, /history → /api/history, /history/:id → /api/history/:id. Frontend sends audio as multipart/form-data with key "audio"; backend accepts .wav/.mp3/.m4a/.webm/.ogg.
- Cloudflare tunnel port map (CURRENT): voicetotext.percubaan.com→3000 (Next.js, proxies to Flask 5000), dashboard.percubaan.com→5173, api.percubaan.com→5555 (voice-model /inference endpoint).
- ecosystem.config.js has 5 pm2 apps: dashboard (vite preview, 5173), voice-model-server (Flask 5555), vtt-backend (Flask 5000), investment-agent, vtt-frontend (Next.js dev 3000).
- voice-model/server.py endpoint is POST /inference (not /transcribe). Only accessible via api.percubaan.com or localhost. vtt-frontend does NOT call it — the full flow goes through vtt-backend/transcriber.py which embeds Whisper directly.
- Dashboard obsidian sync: calls voicetotext.percubaan.com/api/obsidian/append — served by Next.js API route at vtt-app/frontend/pages/api/obsidian/append.js which does fs.appendFileSync to obsidian/AI-Dev-Agent/. CORS header set for dashboard.percubaan.com.
- NEXT_PUBLIC_API_URL=https://voicetotext.percubaan.com (VTT frontend). VTT_BACKEND_URL=http://localhost:5000 (server-side only, used in next.config.js rewrites).
- dashboard MAX_TOKENS = 4096 in claudeAgent.js (was 1000, caused truncation on coder/planner output).
- Telegram bot token: in investment-agent/.env (authoritative), vtt-app/backend/.env, dashboard/.env — all same token/chat_id. Backend reads via python-dotenv; dashboard reads via import.meta.env.VITE_TELEGRAM_TOKEN.
- vtt-app/backend/database.py: SQLite at vtt-app/data/history.db. Table `transcriptions` (id, text, timestamp, duration_seconds, model_used, language, confidence). Functions: save_transcription(), get_history(limit=50), get_stats(), delete_transcription(id). Uses contextmanager `_conn()` for auto-commit/close.
- vtt-app/backend/transcriber.py: loads model once (module-level singletons). Checks voice-model/models/config.json to decide fine-tuned vs base. Falls back to base if fine-tuned fails. Confidence = avg max-token probability from output_scores. Returns {text, duration_seconds, model_used, language, confidence}.
- vtt-app/backend/telegram.py: same pattern as investment-agent/telegram_utils.py. TOKEN + CHAT_ID from .env via python-dotenv. HTML parse_mode. Silent fail. Malay UI strings.
- vtt-app/backend/app.py: Flask entry point on port 5000. Blueprints registered at url_prefix='/api'. CORS on /api/* only. Serves ../frontend/ as static files. Calls database.init_db() + notify_server_start() on startup.
- vtt-app/backend/routes/transcribe.py: Blueprint transcribe_bp. POST /api/transcribe — validates ext (.wav/.mp3/.m4a/.webm/.ogg), saves to /tmp/, calls transcriber.transcribe(), saves to DB, notifies Telegram, cleans up tmp file in finally block.
- vtt-app/backend/routes/history.py: Blueprint history_bp. GET /api/history?limit=N, GET /api/stats, DELETE /api/history/<id>.
- vtt-app port changed to 5000 (app.py). ecosystem.config.js and cloudflared config updated to match.
- vtt-app backend tests: 52 tests, 0 failures. conftest.py mocks torch/transformers/librosa/soundfile/numpy via sys.modules at module level (before transcriber import). Routes use `from telegram import X` binding — must patch `routes.transcribe.notify_*`, not `telegram.notify_*`.
- SQLite ORDER BY: use `id DESC` not `timestamp DESC` — CURRENT_TIMESTAMP has 1-second precision, same-second inserts sort non-deterministically.
- investment-agent/ COMPLETE: config.py, fetcher.py (15-min cache), portfolio.py, alerts.py, notifier.py (emoji format), obsidian_logger.py, scheduler.py (5 jobs), main.py, telegram_utils.py. Tracks IGB REIT (5227.KL), Sunway REIT (5176.KL), Axis REIT (5106.KL). Target RM200/month.
- investment-agent scheduler jobs: daily_report (8am), hourly_price_alerts (9am-5pm Mon-Fri), ex_dividend_check (Mon 8am), weekly_summary (Sun 8am), midnight_snapshot (midnight → obsidian).
- investment-agent alerts.py stores _prev_prices/_prev_yields in module-level dicts — reset on each process restart. Notifier functions in notifier.py, not alerts.py.
- investment-agent config.py uses MY_HOLDINGS with 'code' as full Yahoo Finance code (e.g. '5227.KL'), 'units' and 'avg_price' set to 0 by default (update when buying).
- investment-agent fetcher.py: 15-min dict cache keyed by code. get_price(), get_daily_change(), get_annual_dividends(), get_next_ex_dividend(), fetch_all_holdings() — all cached separately.


- vtt-app Next.js frontend plan: App Router, Tailwind, no extra libs. Custom hooks: useRecorder (MediaRecorder), useWaveform (AudioContext + AnalyserNode + rAF on canvas), useHistory (fetch/prepend/delete). Static export → Flask serves out/ dir. Dev proxy rewrites /api/* → localhost:5000. History update: optimistic prepend from POST response, then stats refetch only (no history refetch).
- All interactive Next.js components need "use client" — MediaRecorder/AudioContext are browser-only. Guard with typeof window !== 'undefined'.
- vtt-app/frontend/components/Waveform.js: ES module class. constructor(canvas) → draws idle cyan bars. start(stream) creates AudioContext+AnalyserNode, rAF loop draws 24 bars centered vertically, COLOR=#06b6d4, fftSize=64. stop() cancels rAF, closes AudioContext, draws idle state. _roundRect polyfills ctx.roundRect for older browsers. Static fields NUM_BARS=24, BAR_W=4, GAP=3.
- vtt-app/frontend/components/Recorder.js: ES module class. State: idle→recording→processing→idle. Options: {url, onStateChange, onTimer, onStream, onResult, onError}. start() → getUserMedia → MediaRecorder(webm/ogg) → 1s timer → setState('recording'). stop() → halt tracks, mediaRecorder.stop() → _submit(). _submit() → FormData POST → onResult({id,text,duration,model_used,language}) or onError. NotAllowedError → Malay permission msg. TypeError/Failed to fetch → Malay unreachable msg. onStream(stream|null) lets caller wire Waveform.start/stop.
- Cloudflare URL mapping: api.percubaan.com→5555 (voice-model /transcribe), voicetotext.percubaan.com→5000 (vtt-backend /api/transcribe). Recorder.js defaults to https://api.percubaan.com/transcribe per user spec; to use vtt-backend pass url:'https://voicetotext.percubaan.com/api/transcribe'.
- vtt-app Next.js frontend BUILT (Pages Router, NOT App Router — no "use client" needed). Files: components/Transcription.js, components/History.js, pages/index.js, pages/_app.js, styles/globals.css, package.json, next.config.js, tailwind.config.js, postcss.config.js, .env.example. output: standalone (run with node .next/standalone/server.js on port 3001).
- pages/index.js: dynamically imports Waveform + Recorder via Promise.all(import()) inside useEffect — avoids SSR crash. State: recState/timer/result/error/historyKey in React state. historyKey increments on new result → triggers History re-fetch.
- Transcription.js: fade-in via useEffect keyed on result?.id (resets opacity→0 then setTimeout(→1,20ms)). modelLabel: openai/* → 'Whisper Asas', else 'Model Tersuai'. isProcessing → shows Spinner. no result → empty state.
- History.js: load() fetches NEXT_PUBLIC_API_URL/history?limit=200 on mount + every refreshKey change. Pagination: PAGE_SIZE=10, prev/next buttons. Delete: fetch DELETE /history/:id then filter from state. Delete button opacity-40 → group-hover:opacity-100.
- NEXT_PUBLIC_API_URL env: set in next.config.js env block as default, override via .env.local. Component reads process.env.NEXT_PUBLIC_API_URL (inlined at build time).
- vtt-app frontend tests: 40 tests, 0 failures (Recorder.test.js 7, Transcription.test.js 17, History.test.js 16). Jest config: next/jest with testEnvironment jsdom. Import @testing-library/jest-dom directly in each test file (no setupFilesAfterFramework needed).
- Recorder test strategy: mock Waveform/Recorder/Transcription/History/next-head in jest.mock() calls; use jest.requireMock() in beforeEach to configure Recorder mock implementation per test; await act(async()=>{render(<Home/>)}) to flush dynamic imports; test button labels and callbacks via onStateChange/onTimer/onError callbacks.
- Transcription test strategy: mock navigator.clipboard via Object.defineProperty in beforeEach; use jest.useFakeTimers for copy feedback timeout; render with isProcessing=true for spinner tests; use await act(async()=>{render(...)}) so useEffect/setTimeout flush.
- History test strategy: mock global.fetch with mockResolvedValueOnce sequences; mockFetchSequence helper for load+delete flows; await act(async()=>{render(...)}) to flush async useEffect fetch; check delete by stringContaining('/history/1') so URL prefix doesn't matter.
- Canvas mock: HTMLCanvasElement.prototype.getContext = () => ({clearRect,fillRect,beginPath,fill,roundRect}) in beforeAll. Needed for Recorder tests since pages/index.js renders a canvas element.

- E2E system test 2026-06-27: all 6/6 tests passed. Backend health, history endpoint (/api/history), Next.js frontend (port 3000), Vite dashboard (port 5173), pm2 5/5 services online, Cloudflare tunnel 3/3 URLs live.
- Vite dev mode (`vite`) injects CSS via JavaScript — silently fails through Cloudflare tunnel/reverse proxy. Always use `vite preview` (production build) for tunnel-exposed services. Production build generates real `<link rel="stylesheet">` tag.
- VITE_* env vars are inlined at BUILD TIME in Vite. Changing dashboard/.env requires npm run build + pm2 restart dashboard — not just a process restart.
- cloudflared does NOT support SIGHUP config reload (exits with code 129). Full kill + restart required: `kill <pid> && cloudflared tunnel run <name> &`.
- Two cloudflared config files can coexist: ~/.cloudflared/config.yml (ACTIVE — what the running process uses) vs /etc/cloudflared/config.yml (system copy, inactive). Check `ps aux | grep cloudflared` to confirm which file the running process loaded.
- obsidianSync.js Obsidian write endpoint: POST voicetotext.percubaan.com/api/obsidian/append (Next.js API route, pages/api/obsidian/append.js). Writes via fs.appendFileSync server-side. CORS header set for dashboard.percubaan.com.
- pm2 "Use --update-env to update environment variables" is NOT an error — it's about pm2's own env block in ecosystem.config.js, not the app's .env file. App .env files are re-read by python-dotenv / node on process startup.

## Things to Avoid
- Don't import Telegram token/chat_id as hardcoded strings — always read from `import.meta.env` so keys stay out of source.
- Don't scroll ActivityLog imperatively on every render — only trigger on `entries.length` change.
- Don't call the Anthropic API without `anthropic-dangerous-direct-browser-access: true` from browser — request will be blocked.
- Don't share the API key in the codebase — must stay in `.env` (gitignored).
- Don't use `vite` (dev server) behind Cloudflare tunnel — CSS injection via JS fails silently. Use `vite preview` (production build).
- Don't change `VITE_*` env vars without rebuilding the Vite app — they're inlined at build time.
- Don't use `ORDER BY timestamp DESC` for SQLite history queries — CURRENT_TIMESTAMP has 1-second granularity. Use `ORDER BY id DESC`.
- Don't restart cloudflared with SIGHUP — use kill + restart.
- Don't patch `telegram.notify_*` in pytest — patch `routes.transcribe.notify_*` (bound via `from telegram import ...`).

