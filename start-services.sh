#!/bin/bash
# Auto-start script for percubaan.com services
# Triggered by ~/.config/autostart/percubaan-services.desktop on login

export PATH="/home/penyahpepijat/.var/app/com.visualstudio.code/config/nvm/versions/node/v20.20.2/bin:/home/penyahpepijat/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

NODE="/home/penyahpepijat/.var/app/com.visualstudio.code/config/nvm/versions/node/v20.20.2/bin/node"
PM2="/home/penyahpepijat/.var/app/com.visualstudio.code/data/node_modules/lib/node_modules/pm2/bin/pm2"
CLOUDFLARED="/home/penyahpepijat/.local/bin/cloudflared"
LOG="/home/penyahpepijat/claude/start-services.log"

echo "[$(date)] Starting percubaan services..." >> "$LOG"

# Wait for network to be up
sleep 8

# Start cloudflared tunnel
if pgrep -f "cloudflared tunnel" > /dev/null; then
    echo "[$(date)] cloudflared already running" >> "$LOG"
else
    $CLOUDFLARED tunnel run percubaan-tunnel >> "$LOG" 2>&1 &
    echo "[$(date)] cloudflared started (PID $!)" >> "$LOG"
fi

# Resurrect pm2 saved processes
# Run inside the VSCode Flatpak sandbox so Python services use Python 3.13 (which has torch/numpy)
# If flatpak is not available, fall back to direct host context (Python 3.14, no transcription)
if command -v flatpak > /dev/null 2>&1 && flatpak info com.visualstudio.code > /dev/null 2>&1; then
    echo "[$(date)] Using Flatpak context (Python 3.13) for pm2" >> "$LOG"
    flatpak run --command=/bin/bash com.visualstudio.code -- -c "$NODE $PM2 resurrect" >> "$LOG" 2>&1
else
    echo "[$(date)] Flatpak not available, using host context (Python 3.14)" >> "$LOG"
    $NODE $PM2 resurrect >> "$LOG" 2>&1
fi
echo "[$(date)] pm2 resurrect done" >> "$LOG"
