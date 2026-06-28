# percubaan.com — AI Dev Stack

Malaysian AI developer stack. All services run locally, exposed via Cloudflare tunnel.

---

## Live URLs

| URL | Service |
|---|---|
| https://voicetotext.percubaan.com | VTT App — record or upload audio → Malay transcript |
| https://dashboard.percubaan.com | AI Agent Dashboard — 4-agent workflow orchestration |
| https://api.percubaan.com | Voice Model API — `POST /inference` |
| https://qrgenerator.percubaan.com | QR Code Generator |

---

## Services & Ports

| pm2 name | Stack | Port | Directory |
|---|---|---|---|
| vtt-frontend | Next.js (Pages Router) | 3000 | `vtt-app/frontend/` |
| vtt-backend | Python Flask + Whisper | 5000 | `vtt-app/backend/` |
| dashboard | Vite preview (React + Tailwind) | 5173 | `dashboard/` |
| voice-model-server | Python Flask | 5555 | `voice-model/` |
| investment-agent | Python APScheduler | — | `investment-agent/` |
| qr-generator | Python Flask | 5002 | `qr-generator/` |

---

## Start Everything (after reboot / crash)

```bash
NODE="/home/penyahpepijat/.var/app/com.visualstudio.code/config/nvm/versions/node/v20.20.2/bin/node"
PM2="/home/penyahpepijat/.var/app/com.visualstudio.code/data/node_modules/lib/node_modules/pm2/bin/pm2"

# 1. Start cloudflared tunnel
~/.local/bin/cloudflared tunnel run percubaan-tunnel &

# 2. Resurrect all pm2 processes (uses saved dump.pm2)
$NODE $PM2 resurrect
```

> **Note:** After login, `~/.config/autostart/percubaan-services.desktop` does this automatically (8s delay for network).

---

## Common Commands

### Check status
```bash
NODE="/home/penyahpepijat/.var/app/com.visualstudio.code/config/nvm/versions/node/v20.20.2/bin/node"
PM2="/home/penyahpepijat/.var/app/com.visualstudio.code/data/node_modules/lib/node_modules/pm2/bin/pm2"

$NODE $PM2 status                    # all services
$NODE $PM2 monit                     # live CPU/RAM + logs TUI
$NODE $PM2 logs                      # tail all logs
$NODE $PM2 logs vtt-backend          # tail one service
$NODE $PM2 logs investment-agent     # investment agent logs
pgrep -a cloudflared                 # check tunnel is running
```

### Restart a service
```bash
# Simple restart (reuses cached config)
$NODE $PM2 restart vtt-backend

# Restart after ecosystem.config.js change (MUST delete first)
$NODE $PM2 delete vtt-frontend
$NODE $PM2 start /home/penyahpepijat/claude/ecosystem.config.js --only vtt-frontend

# Save process list after any change
$NODE $PM2 save
```

### Restart cloudflared tunnel
```bash
pkill -f "cloudflared tunnel run"
~/.local/bin/cloudflared tunnel run percubaan-tunnel &
```

### Add a new tunnel subdomain
```bash
# 1. Edit ~/.cloudflared/config.yml — add ingress rule
# 2. Create DNS record
~/.local/bin/cloudflared tunnel route dns b5fdaa0f-2210-403e-b2dd-bd63c1b5a1cd <subdomain.percubaan.com>
# 3. Restart tunnel
pkill -f "cloudflared tunnel run"
~/.local/bin/cloudflared tunnel run percubaan-tunnel &
```

---

## Service-Specific Commands

### VTT Backend
```bash
cd /home/penyahpepijat/claude/vtt-app/backend
curl http://localhost:5000/health
curl http://localhost:5000/api/history
```

### VTT Frontend
```bash
cd /home/penyahpepijat/claude/vtt-app/frontend
# After changing next.config.js or .env — frontend hot-reloads automatically in dev mode
# No rebuild needed for page/component changes in dev mode
```

### Dashboard (Vite)
```bash
cd /home/penyahpepijat/claude/dashboard
# After changing dashboard/.env (MUST rebuild — VITE_* vars are baked in at build time)
npm run build
$NODE $PM2 restart dashboard

# Set Anthropic API key (required for agent workflows)
nano .env   # set VITE_ANTHROPIC_API_KEY=sk-ant-...
npm run build
$NODE $PM2 restart dashboard
```

### Investment Agent
```bash
cd /home/penyahpepijat/claude/investment-agent
cat .env                              # check Telegram creds
python3 main.py                       # test run (Ctrl+C to stop)
$NODE $PM2 logs investment-agent      # live logs via pm2
```

### QR Generator
```bash
curl http://localhost:5002/           # check it's running
# Access at https://qrgenerator.percubaan.com
```

### Voice Model
```bash
curl http://localhost:5555/health
curl -X POST http://localhost:5555/inference \
  -F "audio=@/path/to/file.wav"
```

---

## Environment Files

| File | Purpose |
|---|---|
| `dashboard/.env` | `VITE_ANTHROPIC_API_KEY`, `VITE_TELEGRAM_TOKEN`, `VITE_TELEGRAM_CHAT_ID`, `VITE_BACKEND_URL` |
| `investment-agent/.env` | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TARGET_MONTHLY_INCOME` |
| `vtt-app/backend/.env` | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `PORT` |

---

## Directory Structure

```
/home/penyahpepijat/claude/
├── dashboard/              # Vite + React — AI agent orchestration UI
├── vtt-app/
│   ├── frontend/           # Next.js — record/upload UI
│   └── backend/            # Flask + Whisper — transcription API
├── investment-agent/       # Python APScheduler — REIT monitoring
├── qr-generator/           # Flask — QR code generator
├── voice-model/            # Whisper fine-tune pipeline
├── obsidian/
│   └── AI-Dev-Agent/       # Project knowledge base (Obsidian vault)
├── ecosystem.config.js     # pm2 process definitions
├── start-services.sh       # Boot startup script
└── README.md               # This file
```

---

## Tunnel Config

File: `~/.cloudflared/config.yml`

```yaml
tunnel: b5fdaa0f-2210-403e-b2dd-bd63c1b5a1cd
credentials-file: /home/penyahpepijat/.cloudflared/b5fdaa0f-2210-403e-b2dd-bd63c1b5a1cd.json

ingress:
  - hostname: voicetotext.percubaan.com
    service: http://localhost:3000
  - hostname: dashboard.percubaan.com
    service: http://localhost:5173
  - hostname: api.percubaan.com
    service: http://localhost:5555
  - hostname: qrgenerator.percubaan.com
    service: http://localhost:5002
  - service: http_status:404
```

---

## Boot Persistence

Services auto-start on login via XDG autostart:
- **Desktop file:** `~/.config/autostart/percubaan-services.desktop`
- **Script:** `~/claude/start-services.sh`
- Waits 8s for network, starts cloudflared, then `pm2 resurrect`

If auto-start fails, run the two commands in **Start Everything** above manually.

---

## Useful Shortcuts

```bash
# Alias for pm2 (add to ~/.bashrc)
alias pm2='$NODE $PM2'

# Quick health check all services
curl -s http://localhost:5000/health | python3 -m json.tool
curl -s http://localhost:5555/health | python3 -m json.tool
curl -s http://localhost:5002/

# Watch investment agent
tail -f ~/.pm2/logs/investment-agent-out.log

# Watch VTT transcriptions
tail -f ~/.pm2/logs/vtt-backend-out.log
```
