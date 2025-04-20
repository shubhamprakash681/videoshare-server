FROM nginx:latest

COPY nginx.conf /etc/nginx/nginx.conf

# Create directories for Let's Encrypt certificates (will be mounted from a volume)
RUN mkdir -p /etc/letsencrypt/live /etc/letsencrypt/archive

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]