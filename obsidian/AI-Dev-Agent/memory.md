# memory.md

## Patterns Learned

### Dashboard (Vite + React 18 + Tailwind)
- Entry: `src/main.jsx`, styles: `src/index.css` with `@tailwind` directives.
- Constants split: `src/constants/agents.js` and `src/constants/workflows.js` — import separately.
- PulseRing: dual-ring CSS keyframe technique (two rings offset by 0.5s). Color passed as string key, mapped to hex — Tailwind can't JIT arbitrary `border-color` hex values, use `style=` prop instead.
- AgentCard: `progress > 0` → determinate bar; `progress === 0` + `status=working` → indeterminate CSS keyframe via `.indeterminate-bar`.
- WorkflowTrack connector line color follows the completed agent's color.
- ActivityLog: `slice(-MAX_ENTRIES)` before render (max 60). Auto-scroll guarded with `typeof scrollIntoView === 'function'` for jsdom compat.
- MemoryPanel: parses raw `memory.md` text by scanning for `## Section` headings — no file-read API needed.
- TaskInput: Ctrl+Enter submits. Run button disabled when `!task.trim() || isRunning`.
- `App.jsx` workflow loop: agents not in current workflow stay idle; upcoming agents get `queued` status with position badge. Previous agent output passed as context to next agent's user message.
- Shared memory: `[timestamp] AgentName: output_preview` appended after each agent. Stored in React state — not persisted between page loads (Obsidian sync handles persistence).

### Claude API (dashboard)
- `claudeAgent.js` uses SSE streaming: reads `data:` lines, parses `content_block_delta` events, calls `onChunk(text)` per delta.
- Requires `anthropic-dangerous-direct-browser-access: true` header for browser direct calls — without it, Anthropic blocks the request.
- `MAX_TOKENS = 4096` — 1000 was too low for coder/planner (truncated at ~750 words).
- Model: `claude-sonnet-4-6`.
- `VITE_ANTHROPIC_API_KEY` must be set in `dashboard/.env` BEFORE running `npm run build` — Vite inlines it at build time.

### Telegram
- Both backend (`telegram.py`) and dashboard (`telegramNotifier.js`) use `parse_mode: HTML` — bold via `<b>`, code via `<code>`.
- Errors swallowed silently (non-critical, never crash main flow).
- Bot token / chat ID: always from env vars (`import.meta.env.VITE_TELEGRAM_TOKEN` in JS, `python-dotenv` in Python). Never hardcode.
- Same bot token and chat ID used across: `investment-agent/.env`, `vtt-app/backend/.env`, `dashboard/.env`.
- **User must send `/start` to the bot before Telegram can deliver messages** — Telegram won't deliver to a chat that hasn't been initiated. Confirmed working as of 2026-06-27 21:06 (log: "Telegram verified").

### Obsidian Sync
- `obsidianSync.js` maps agentId → filename via `OBSIDIAN_FILE_MAP`. Unknown agents fall back to `project-log.md`.
- Endpoint: `POST voicetotext.percubaan.com/api/obsidian/append` with `{ file, content }`.
- Served by Next.js API route `pages/api/obsidian/append.js` — runs server-side, uses `fs.appendFileSync`. CORS header set for `dashboard.percubaan.com`.
- Obsidian files are plain markdown; `formatBlock()` wraps agent output in ` ``` ` fences.

### VTT App Architecture
- Next.js frontend (port 3000) + Flask backend (port 5000) are separate pm2 processes.
- `next.config.js` `async rewrites()` proxies API calls server-side: `/transcribe` → `:5000/api/transcribe`, `/history` → `:5000/api/history`, `/history/:id` → `:5000/api/history/:id`.
- Browser sees everything as same-origin (`voicetotext.percubaan.com`) — no CORS issues.
- `NEXT_PUBLIC_API_URL` is inlined at BUILD TIME in `output: standalone`. Changing `.env` requires `npm run build`.
- Flask blueprints registered at `url_prefix='/api'` — all routes are `/api/transcribe`, `/api/history`, etc. Direct calls to port 5000 need the `/api/` prefix.
- VTT frontend supports two input modes: **Rakam** (microphone record) and **Muat Naik** (file upload). Both POST to `/transcribe` with FormData key `"audio"`. Accepted: `.wav .mp3 .m4a .webm .ogg`.

### Vite + Cloudflare Tunnel
- Vite **dev mode** injects CSS via JavaScript (`__vite__updateStyle()`). This silently fails through Cloudflare tunnel/reverse proxy.
- Vite **production build** (`vite preview`) serves CSS as `<link rel="stylesheet">` — works through any proxy.
- Always use `vite preview` for tunnel-exposed services.
- `VITE_*` env vars inlined at build time — create/update `.env` THEN `npm run build` THEN `pm2 restart`.

### cloudflared
- Two config files can exist: `~/.cloudflared/config.yml` (active) vs `/etc/cloudflared/config.yml` (system).
- Running process uses the config it was started with — check `ps aux | grep cloudflared` for `--config` flag.
- SIGHUP not supported (exit code 129). Reload requires full kill + restart: `kill <pid> && cloudflared tunnel run <name> &`.
- Binary path: `~/.local/bin/cloudflared` — not in system PATH. Use full path or source nvm.
- Add new subdomain: (1) add ingress rule to `~/.cloudflared/config.yml`, (2) run `~/.local/bin/cloudflared tunnel route dns <tunnel-id> <subdomain>`, (3) kill + restart cloudflared.

### pm2
- `pm2 restart` shows "Use --update-env to update environment variables" — this is about pm2's own env block, not the app's `.env` file. App `.env` files ARE re-read by the app on startup.
- To run pm2 via nvm node: `$NODE $PM2 <command>` where `NODE=/path/to/node` and `PM2=/path/to/pm2`.
- **`pm2 restart` uses pm2's CACHED config, not the ecosystem file on disk.** To pick up ecosystem.config.js changes: `pm2 delete <name>` then `pm2 start ecosystem.config.js --only <name>`.
- **Node.js pm2 processes must use full node binary path** + `interpreter: "none"` + explicit PATH in env. Using `script: "npm"` causes hot-reload child processes to fail with `env: 'node': No such file or directory`.
- pm2 save: `$NODE $PM2 save` — saves current process list to `~/.pm2/dump.pm2` for `pm2 resurrect`.

### Boot Persistence (Flatpak/bwrap sandbox)
- PID 1 is `bwrap` (Flatpak bubblewrap sandbox) — no systemd, no sudo, no crontab available.
- `pm2 startup` fails: `Init system not found`.
- `sudo systemctl enable cloudflared` fails: no sudo, no systemctl inside sandbox.
- **Solution: XDG autostart** — `~/.config/autostart/percubaan-services.desktop` triggers on login.
- Boot script: `~/claude/start-services.sh` — waits 8s for network, starts cloudflared if not running, then `pm2 resurrect`.
- `pm2 save` must be run after any process list change to keep `dump.pm2` current for resurrect.

### Flask / Python
- `python-dotenv` reads `.env` on import — creds are available at startup.
- `contextmanager` pattern for SQLite `_conn()` — auto-commit + auto-close, never forget `conn.close()`.
- Mock `torch`, `transformers`, `librosa`, `soundfile`, `numpy` via `sys.modules` in `conftest.py` at module level BEFORE any imports — or `transcriber.py` import will fail in test env.
- `from module import func` creates a local binding — patch `routes.transcribe.notify_*`, not `telegram.notify_*`.

### Next.js (vtt-frontend)
- Pages Router (not App Router) — no `"use client"` needed, simpler for small apps.
- Browser-only modules (Waveform, Recorder): load via `Promise.all([import(...)])` inside `useEffect`.
- `historyKey` counter pattern: increment on success → `useEffect([key])` re-fetches without prop drilling.
- Canvas mock for tests: `HTMLCanvasElement.prototype.getContext = () => ({ clearRect, fillRect, ... })` in `beforeAll`.

### Whisper / Voice Model
- Language: `ms` (Malay). `forced_decoder_ids` + `suppress_tokens=[]` force Malay, disable auto-detect.
- `DataCollator`: replace padding token ids with `-100` so cross-entropy ignores them. Strip leading BOS if present.
- `greater_is_better=False` when `metric_for_best_model='wer'` — easy to forget, lower WER = better.
- `config.py` derives `BASE_DIR` from `os.path.abspath(__file__)` — works regardless of cwd.
- Module-level singletons in `inference.py` — model loads once, reused across requests.
- Falls back to `openai/whisper-small` if `models/` is empty or `config.json` is missing.
- **`low_cpu_mem_usage=False` required** in `from_pretrained()` — newer transformers defaults to `True`, creating meta tensors. `.to(device)` on meta tensor raises `NotImplementedError: Cannot copy out of meta tensor`.

### Investment Agent
- Uses `.KL` suffix on all Yahoo Finance tickers (e.g., `5227.KL` for Bursa Malaysia).
- 15-min module-level dict cache per data type (`_price_cache`, `_div_cache`, `_exdiv_cache`, `_change_cache`).
- APScheduler `BlockingScheduler` with `CronTrigger(timezone='Asia/Kuala_Lumpur')`.
- Telegram via raw `requests.post` — avoids async conflict with BlockingScheduler (not python-telegram-bot).
- `TZ: "Asia/Kuala_Lumpur"` set in ecosystem.config.js env for the pm2 process.

---

## Bugs Fixed

| Date | Bug | Fix |
|---|---|---|
| 2026-06-26 | `ActivityLog.jsx`: `scrollIntoView` throws in jsdom | Guard: `typeof scrollIntoView === 'function'` |
| 2026-06-27 | `ORDER BY timestamp DESC` non-deterministic (1s granularity) | Changed to `ORDER BY id DESC` in `database.get_history()` |
| 2026-06-27 | `numpy` not installed → `import transcriber` fails in tests | Added `numpy` to `sys.modules` mock in `conftest.py` |
| 2026-06-27 | No empty-file validation in `/api/transcribe` route | Added 0-byte check, returns 400 |
| 2026-06-27 | Firefox: `.ogg` rejected by ALLOWED_EXTENSIONS | Added `.ogg` to `routes/transcribe.py` |
| 2026-06-27 | Dashboard CSS invisible through Cloudflare tunnel | Switched `ecosystem.config.js` dashboard from `vite` to `vite preview` |
| 2026-06-27 | `MAX_TOKENS=1000` truncating coder/planner output | Bumped to `4096` in `claudeAgent.js` |
| 2026-06-27 | `NEXT_PUBLIC_API_URL` pointed at voice-model server (wrong API) | Set to `https://voicetotext.percubaan.com` |
| 2026-06-27 | No proxy between Next.js port 3000 and Flask port 5000 | Added `async rewrites()` in `next.config.js` |
| 2026-06-27 | `obsidianSync.js` calling `api.percubaan.com/obsidian/append` (no such route) | Changed to `voicetotext.percubaan.com/api/obsidian/append` |
| 2026-06-27 | `/obsidian/append` endpoint didn't exist | Created `pages/api/obsidian/append.js` (Next.js API route, fs.appendFileSync) |
| 2026-06-27 | `~/.cloudflared/config.yml` had `voicetotext → port 5000` (wrong) | Updated to port 3000 (Next.js), restarted cloudflared |
| 2026-06-27 | `dashboard/.env` missing → all VITE_* vars undefined at build | Created `.env` with Telegram creds + VITE_BACKEND_URL, rebuilt |
| 2026-06-27 | `vtt-app/backend/.env` had empty Telegram creds | Filled in token and chat_id from investment-agent/.env |
| 2026-06-27 | vtt-frontend: 32→47 restarts, `env: 'node': No such file or directory` | Changed ecosystem.config.js from `script:"npm"` to full node path + `interpreter:"none"` + PATH |
| 2026-06-27 | VTT 500 error: `NotImplementedError: Cannot copy out of meta tensor` | Added `low_cpu_mem_usage=False` to both `from_pretrained()` calls in transcriber.py |

---

## Decisions Made

### Architecture
- No extra UI libraries in dashboard — React + Tailwind only, keeps bundle small, avoids version conflicts.
- Pages Router over App Router for vtt-frontend — no `"use client"`, simpler SSR model for a small app.
- `output: standalone` for Next.js — run with `node .next/standalone/server.js`, separate from Flask.
- Obsidian sync via Next.js API route (not Flask) — server-side fs access, no new backend service needed.
- SQLite for transcription history — simple, no separate DB server, embedded in backend process.
- QR Generator as standalone Flask app (not bundled into existing service) — clean separation, own port (5002).

### Routing
- All VTT frontend traffic through Next.js (port 3000) → Flask proxy. Browser sees single origin.
- Cloudflare tunnel: `voicetotext → 3000` (Next.js), `dashboard → 5173` (Vite), `api → 5555` (voice-model), `qrgenerator → 5002`.
- `api.percubaan.com` is exclusively for the voice-model inference server (`POST /inference`). Not used by vtt-frontend.

### Voice Model
- Base: `openai/whisper-small`, language `ms`, task `transcribe`.
- Audio preprocessing: `librosa.load(sr=16000, mono=True)`, peak-normalise, drop clips >30s (Whisper hard limit).
- WER evaluation via `jiwer.Compose` (lowercase, strip punctuation) before scoring — prevents false penalties.
- Per-sample + aggregate results saved to `voice-model/results.json` with timestamp.
- Colab: notebook patches `config.*` paths at runtime, syncs checkpoints via Google Drive.

### Dev tooling
- Dashboard tests: Vitest + @testing-library/react (matches Vite setup).
- VTT frontend tests: Jest + next/jest + @testing-library/react (matches Next.js ecosystem).
- VTT backend tests: pytest + tmp_path SQLite fixture, ML packages mocked via sys.modules.

---

## Things to Avoid

- **Don't hardcode Telegram token/chat_id** — always `import.meta.env.VITE_TELEGRAM_TOKEN` (JS) or `os.environ` via dotenv (Python).
- **Don't call Anthropic API from browser without `anthropic-dangerous-direct-browser-access: true`** — request will be blocked.
- **Don't share API key in codebase** — must stay in `.env` (gitignored).
- **Don't scroll ActivityLog on every render** — only trigger `scrollIntoView` on `entries.length` change.
- **Don't use `vite dev` behind Cloudflare tunnel** — CSS injection via JS fails silently. Use `vite preview` (production build).
- **Don't change `VITE_*` env vars without rebuilding** — they're inlined at build time.
- **Don't use `ORDER BY timestamp DESC` for SQLite history** — 1-second granularity causes non-deterministic order on rapid inserts. Use `ORDER BY id DESC`.
- **Don't patch `telegram.notify_*` in tests** — patch `routes.transcribe.notify_*` (where the function is bound after `from telegram import ...`).
- **Don't restart cloudflared with SIGHUP** — it exits with code 129. Use kill + restart.
- **Don't use `pm2 restart` to pick up ecosystem.config.js changes** — it reads cached config. Use `pm2 delete <name>` + `pm2 start ecosystem.config.js --only <name>`.
- **Don't use `script: "npm"` in pm2 for Node.js apps** — hot-reload child processes fail without node in PATH. Use full node binary path + `interpreter: "none"`.
- **Don't use `low_cpu_mem_usage=True` (default) in `from_pretrained()`** — creates meta tensors that crash on `.to(device)`. Always pass `low_cpu_mem_usage=False`.
