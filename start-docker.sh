#!/bin/bash

# klmToVideo Docker Quick Start Script
# =====================================
# This script helps you get started with the dockerized version of klmToVideo

set -e

echo "🚀 klmToVideo - Docker Quick Start"
echo "=================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first:"
    echo "   https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first:"
    echo "   https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker is installed"
echo "✅ Docker Compose is installed"
echo ""

# Create necessary directories if they don't exist
echo "📁 Creating necessary directories..."
mkdir -p guiv2/workspace
mkdir -p guiv2/server/uploads
mkdir -p output

echo "✅ Directories created"
echo ""

# Check if containers are already running
if docker ps | grep -q klmtovideo-app; then
    echo "⚠️  Container is already running"
    echo ""
    read -p "Do you want to restart it? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔄 Restarting containers..."
        docker-compose down
        docker-compose up -d
    fi
else
    # Build and start containers
    echo "🔨 Building Docker image (this may take a few minutes)..."
    docker-compose build

    echo ""
    echo "🚀 Starting containers..."
    docker-compose up -d

    echo ""
    echo "⏳ Waiting for application to be ready..."
    sleep 5
fi

# Check health status
echo ""
echo "🏥 Checking application health..."
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if docker ps | grep -q "klmtovideo-app.*healthy"; then
        echo "✅ Application is healthy!"
        break
    elif docker ps | grep -q klmtovideo-app; then
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    else
        echo ""
        echo "❌ Container is not running. Check logs with: docker-compose logs"
        exit 1
    fi
done

if [ $attempt -eq $max_attempts ]; then
    echo ""
    echo "⚠️  Health check timeout. The application might still be starting."
    echo "   Check logs with: docker-compose logs -f"
fi

echo ""
echo "=========================================="
echo "✅ klmToVideo is now running!"
echo "=========================================="
echo ""
echo "🌐 Access the application at:"
echo "   http://localhost:3001"
echo ""
echo "📊 Useful commands:"
echo "   docker-compose logs -f          # View logs"
echo "   docker-compose down             # Stop containers"
echo "   docker-compose restart          # Restart containers"
echo "   docker exec -it klmtovideo-app bash  # Open shell in container"
echo ""
echo "📁 Your workspaces are stored in:"
echo "   ./guiv2/workspace"
echo ""
echo "Happy video encoding! 🎬"
