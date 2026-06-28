#!/bin/bash
# Install dependencies
pip install -r requirements.txt

# Copy .env if not exists
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example — please update values"
fi

# Start server
uvicorn main:socket_app --host 0.0.0.0 --port 8000 --reload
