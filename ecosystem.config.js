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
      script: "/home/penyahpepijat/claude/run-python.sh",
      args: "server.py",
      cwd: "/home/penyahpepijat/claude/voice-model",
      interpreter: "none",
      env: {
        PYTHONUNBUFFERED: "1",
        PYTHONUSERBASE: "/var/data/python",
        PYTHONPATH: "/var/data/python/lib/python3.13/site-packages:/app/lib/python3.13/site-packages"
      }
    },
    {
      name: "vtt-backend",
      script: "/home/penyahpepijat/claude/run-python.sh",
      args: "app.py",
      cwd: "/home/penyahpepijat/claude/vtt-app/backend",
      interpreter: "none",
      env: {
        PYTHONUNBUFFERED: "1",
        PYTHONUSERBASE: "/var/data/python",
        PYTHONPATH: "/home/penyahpepijat/py314-packages",
        PORT: "5000"
      }
    },
    {
      name: "qr-generator",
      script: "/home/penyahpepijat/claude/run-python.sh",
      args: "app.py",
      cwd: "/home/penyahpepijat/claude/qr-generator",
      interpreter: "none",
      env: {
        PYTHONUNBUFFERED: "1",
        PYTHONUSERBASE: "/var/data/python",
        PYTHONPATH: "/home/penyahpepijat/py314-packages",
        PORT: "5002"
      }
    },
    {
      name: "investment-agent",
      script: "/home/penyahpepijat/claude/run-python.sh",
      args: "main.py",
      cwd: "/home/penyahpepijat/claude/investment-agent",
      interpreter: "none",
      env: {
        PYTHONUNBUFFERED: "1",
        PYTHONUSERBASE: "/var/data/python",
        PYTHONPATH: "/home/penyahpepijat/py314-packages",
        TZ: "Asia/Kuala_Lumpur"
      }
    },
    {
      name: "vtt-frontend",
      script: "/home/penyahpepijat/.var/app/com.visualstudio.code/config/nvm/versions/node/v20.20.2/bin/node",
      args: "node_modules/.bin/next start -H 0.0.0.0 -p 3000",
      cwd: "/home/penyahpepijat/claude/vtt-app/frontend",
      interpreter: "none",
      env: {
        PATH: "/home/penyahpepijat/.var/app/com.visualstudio.code/config/nvm/versions/node/v20.20.2/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
        NODE_ENV: "production",
        PORT: "3000"
      }
    }
  ]
}
