#!/bin/bash
set -e

DOMAIN="payroll.nikatechsolutions.com"

echo "=== Setting up SSL for $DOMAIN ==="

# Stop nginx temporarily so certbot can use port 80
cd /root/BenPayroll/web-app
docker compose stop frontend

# Get SSL certificate
certbot certonly --standalone -d "$DOMAIN" --non-interactive --agree-tos --email admin@nikatechsolutions.com

# Switch to SSL nginx config
cp nginx-ssl.conf nginx.conf

# Add SSL volumes to docker-compose
cat > docker-compose.yml << 'COMPOSE'
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    expose:
      - "8000"
    env_file:
      - ./backend/.env
    environment:
      - PYTHONUNBUFFERED=1
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
      - /etc/letsencrypt:/etc/letsencrypt:ro
      - /var/www/certbot:/var/www/certbot:ro
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
    restart: unless-stopped
COMPOSE

# Restart with SSL
docker compose up -d

# Set up auto-renewal cron
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && cd /root/BenPayroll/web-app && docker compose restart frontend") | crontab -

echo ""
echo "=== SSL setup complete ==="
echo "App is now running on https://$DOMAIN"
echo "Certificate auto-renewal is configured."
