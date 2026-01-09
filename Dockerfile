# Development Dockerfile - No build step, uses mounted volumes for hot reload
FROM node:22-bullseye-slim

# Install system dependencies including ffmpeg
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Set environment to development
ENV NODE_ENV=development \
    PORT=3001 \
    WORKSPACE_ROOT=/app/workspace \
    SD_WIDTH=640 \
    SD_CRF=28 \
    SD_PRESET=veryfast \
    SD_AUDIO_BITRATE=96k \
    MAX_CONCURRENT_JOBS=3 \
    JOB_CLEANUP_MS=30000

# Create workspace and uploads directories
RUN mkdir -p /app/workspace /app/guiv2/server/uploads

# Expose ports
# 3001 for server API
# 5173 for Vite dev server (UI)
EXPOSE 3001 5173

# Install dependencies on container start (will use node_modules from host if mounted)
# Start command will be handled by docker-compose
CMD ["npm", "run", "dev"]
