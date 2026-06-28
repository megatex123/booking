module.exports = {
  apps: [
    {
      name: "dashboard",
      script: "/home/penyahpepijat/.var/app/com.visualstudio.code/config/nvm/versions/node/v20.20.2/bin/node",
      args: "node_modules/.bin/vite preview --host 0.0.0.0 --port 5173",
      cwd: "/home/penyahpepijat/claude/dashboard",
      interpreter: "none",
      env: {
        PATH: "/home/penyahpepijat/.var/app/com.visualstudio.code/config/nvm/versions/node/v20.20.2/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
        NODE_ENV: "production"
      }
    },
    {
      name: "voice-model-server",
      script: "/usr/bin/python3",
      args: "server.py",
      cwd: "/home/penyahpepijat/claude/voice-model",
      interpreter: "none",
      env: {
        PYTHONUNBUFFERED: "1"
      }
    },
    {
      name: "vtt-backend",
      script: "/usr/bin/python3",
      args: "app.py",
      cwd: "/home/penyahpepijat/claude/vtt-app/backend",
      interpreter: "none",
      env: {
        PYTHONUNBUFFERED: "1",
        PORT: "5000"
      }
    },
    {
      name: "qr-generator",
      script: "/usr/bin/python3",
      args: "app.py",
      cwd: "/home/penyahpepijat/claude/qr-generator",
      interpreter: "none",
      env: {
        PYTHONUNBUFFERED: "1",
        PORT: "5002"
      }
    },
    {
      name: "investment-agent",
      script: "/usr/bin/python3",
      args: "main.py",
      cwd: "/home/penyahpepijat/claude/investment-agent",
      interpreter: "none",
      env: {
        PYTHONUNBUFFERED: "1",
        TZ: "Asia/Kuala_Lumpur"
      }
    },
    {
      name: "vtt-frontend",
      script: "/home/penyahpepijat/.var/app/com.visualstudio.code/config/nvm/versions/node/v20.20.2/bin/node",
      args: "node_modules/.bin/next dev -H 0.0.0.0 -p 3000",
      cwd: "/home/penyahpepijat/claude/vtt-app/frontend",
      interpreter: "none",
      env: {
        PATH: "/home/penyahpepijat/.var/app/com.visualstudio.code/config/nvm/versions/node/v20.20.2/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
        NODE_ENV: "development",
        PORT: "3000"
      }
    }
  ]
}
