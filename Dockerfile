# Stage 1: Base image with system dependencies
FROM node:22-bullseye-slim AS base

# Install system dependencies including ffmpeg
# Note: canvas package requires build dependencies
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

# Stage 2: Dependencies
FROM base AS dependencies

# Copy package files for all modules
COPY guiv2/package*.json ./guiv2/
COPY guiv2/server/package*.json ./guiv2/server/
COPY guiv2/ui/package*.json ./guiv2/ui/

# Install server dependencies
WORKDIR /app/guiv2/server
RUN npm ci && \
    npm cache clean --force

# Install UI dependencies
WORKDIR /app/guiv2/ui
RUN npm ci && \
    npm cache clean --force

# Stage 3: Build
FROM dependencies AS build

# Copy server source
WORKDIR /app
COPY guiv2/server/ ./guiv2/server/

# Build server (TypeScript -> JavaScript)
WORKDIR /app/guiv2/server
RUN npm run build

# Copy UI source
WORKDIR /app
COPY guiv2/ui/ ./guiv2/ui/

# Build UI (React + Vite)
WORKDIR /app/guiv2/ui
RUN npm run build

# Stage 4: Production
FROM base AS production

# Set environment to production
ENV NODE_ENV=production \
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

WORKDIR /app/guiv2/server

# Copy production node_modules from dependencies stage
COPY --from=dependencies /app/guiv2/server/node_modules ./node_modules
COPY --from=dependencies /app/guiv2/server/package*.json ./

# Copy built server
COPY --from=build /app/guiv2/server/dist ./dist
COPY --from=build /app/guiv2/server/workspace-template ./workspace-template

# Copy built UI to be served by Express
COPY --from=build /app/guiv2/ui/dist ../ui/dist

# Copy root package.json if needed
COPY guiv2/package*.json ../

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Start the application
CMD ["node", "dist/index.js"]
