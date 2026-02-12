#!/bin/bash
set -e

echo "=== BenPayroll Deployment Script ==="

# Step 1: Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    apt-get update
    apt-get install -y ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    echo "Docker installed successfully"
else
    echo "Docker already installed: $(docker --version)"
fi

# Step 2: Install certbot for SSL
if ! command -v certbot &> /dev/null; then
    echo "Installing Certbot..."
    apt-get update
    apt-get install -y certbot
    echo "Certbot installed"
else
    echo "Certbot already installed"
fi

# Step 3: Build and start containers (HTTP first for SSL cert)
echo "Building and starting containers..."
cd /root/BenPayroll/web-app
docker compose down 2>/dev/null || true
docker compose build --no-cache
docker compose up -d

echo "Containers started. Checking status..."
docker compose ps

echo ""
echo "=== Deployment complete ==="
echo "App is running on http://payroll.nikatechsolutions.com"
echo ""
echo "To set up SSL, run: ./setup-ssl.sh"
