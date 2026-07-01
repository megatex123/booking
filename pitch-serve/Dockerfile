FROM nginx:alpine

COPY . /usr/share/nginx/html

RUN printf 'server {\n\
  listen 8082;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  gzip on;\n\
  gzip_types text/html text/css application/javascript;\n\
  add_header X-Frame-Options SAMEORIGIN;\n\
  add_header X-Content-Type-Options nosniff;\n\
  add_header Referrer-Policy strict-origin-when-cross-origin;\n\
  location ~* \\.(jpg|png|svg|ico|woff2)$ {\n\
    expires 30d;\n\
    add_header Cache-Control "public, max-age=2592000, immutable";\n\
  }\n\
  location / {\n\
    try_files $uri $uri/ /index.html;\n\
  }\n\
}' > /etc/nginx/conf.d/default.conf

EXPOSE 8082

CMD ["nginx", "-g", "daemon off;"]
