FROM node:20-bookworm-slim

# Install system dependencies: Python (for yt-dlp), FFmpeg
RUN apt-get update && apt-get install -y \
    python3 \
    python-is-python3 \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*


# Install yt-dlp globally
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Create temp dir and data dir for sqlite
RUN mkdir temp && mkdir -p data && chown -R node:node /app

COPY package*.json ./

# Install npm dependencies
RUN npm install

COPY . .

# Build TypeScript
RUN npm run build

# Ensure permissions
# Ensure permissions for the entire app directory (needed for sqlite write access in root)
RUN chown -R node:node /app

# Switch to non-root
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

CMD ["npm", "start"]
