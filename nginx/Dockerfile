FROM nginx:1.27.4-alpine

COPY nginx.conf /etc/nginx/nginx.conf
COPY sites.conf.template /etc/nginx/templates/default.conf.template

# Create directories for Let's Encrypt certificates (will be mounted from a volume)
RUN mkdir -p /etc/letsencrypt/live /etc/letsencrypt/archive

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
