#!/bin/bash
MONGO_BIN="$HOME/mongodb/bin/mongod"
MONGO_DATA="$HOME/mongodb/data"
MONGO_LOG="$HOME/mongodb/log/mongod.log"
BACKEND_DIR="$(cd "$(dirname "$0")/backend" && pwd)"
MOBILE_DIR="$(cd "$(dirname "$0")/mobile" && pwd)"

export NVM_DIR="$HOME/.var/app/com.visualstudio.code/config/nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# ── MongoDB ──────────────────────────────────────────────────────────────────
if curl -s http://localhost:27017 &>/dev/null; then
  echo "✓ MongoDB already running on :27017"
else
  echo "→ Starting MongoDB..."
  "$MONGO_BIN" \
    --dbpath "$MONGO_DATA" \
    --logpath "$MONGO_LOG" \
    --port 27017 \
    --bind_ip 127.0.0.1 \
    --fork
  sleep 2
  echo "✓ MongoDB started"
fi

# ── Backend ──────────────────────────────────────────────────────────────────
echo "→ Starting FastAPI backend on :8000..."
cd "$BACKEND_DIR"
/var/data/python/bin/uvicorn main:socket_app \
  --host 0.0.0.0 --port 8000 --reload > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
sleep 3

if curl -s http://localhost:8000/health &>/dev/null; then
  echo "✓ Backend running   → http://localhost:8000"
  echo "  API docs          → http://localhost:8000/docs"
else
  echo "✗ Backend failed — check /tmp/backend.log"
  exit 1
fi

# ── Expo Web ─────────────────────────────────────────────────────────────────
echo "→ Building web app (first time may take ~30s)..."
cd "$MOBILE_DIR"
CI=1 npx expo export --platform web > /tmp/expo-build.log 2>&1
if [ $? -ne 0 ]; then
  echo "✗ Build failed — check /tmp/expo-build.log"
  exit 1
fi
echo "✓ Build complete"

echo "→ Serving web app on :8081..."
npx serve dist -p 8081 > /tmp/expo.log 2>&1 &
EXPO_PID=$!
sleep 2

if curl -s http://localhost:8081 &>/dev/null; then
  echo "✓ Mobile app running → http://localhost:8081"
else
  echo "✗ Serve failed — check /tmp/expo.log"
fi

echo ""
echo "════════════════════════════════════════"
echo "  Backend  → http://localhost:8000/docs"
echo "  App      → http://localhost:8081"
echo "════════════════════════════════════════"
echo ""
echo "Logs: tail -f /tmp/backend.log   (backend)"
echo "      tail -f /tmp/expo-build.log (build)"
echo ""
echo "Press Ctrl+C to stop all services"

cleanup() {
  echo "Stopping services..."
  kill $BACKEND_PID $EXPO_PID 2>/dev/null
  pkill -f "uvicorn main:socket_app" 2>/dev/null
  pkill -f "serve dist" 2>/dev/null
}
trap cleanup EXIT INT TERM
wait
