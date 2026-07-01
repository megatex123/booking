# Stage 1 — Build Expo web app
FROM node:22-slim AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Copy source and build
COPY . .
ENV CI=1
RUN npx expo export --platform web

# Stage 2 — Serve with nginx
FROM nginx:alpine AS runner

# Copy the built dist folder
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx config: serve SPA (all paths fall back to index.html)
RUN printf 'server {\n\
  listen 8081;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  gzip on;\n\
  gzip_types text/html text/css application/javascript application/json font/woff2;\n\
  add_header X-Frame-Options SAMEORIGIN;\n\
  add_header X-Content-Type-Options nosniff;\n\
  add_header Referrer-Policy strict-origin-when-cross-origin;\n\
  location ~* \\.(js|css|woff2|png|jpg|svg|ico)$ {\n\
    expires 1y;\n\
    add_header Cache-Control "public, max-age=31536000, immutable";\n\
  }\n\
  location / {\n\
    try_files $uri $uri/ /index.html;\n\
  }\n\
}' > /etc/nginx/conf.d/default.conf

EXPOSE 8081

CMD ["nginx", "-g", "daemon off;"]
