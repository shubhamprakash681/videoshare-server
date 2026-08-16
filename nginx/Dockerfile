FROM nginx:latest

# Remove default configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom config
COPY nginx.conf /etc/nginx/nginx.conf

# Ensure ACME webroot and Let's Encrypt directories exist
RUN mkdir -p /var/www/certbot /etc/letsencrypt/live /etc/letsencrypt/archive

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]