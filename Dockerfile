FROM node:20-bullseye-slim

# Install system dependencies: Python (for yt-dlp), FFmpeg
RUN apt-get update && apt-get install -y \
    python3 \
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
RUN chown -R node:node /app/temp /app/data

# Switch to non-root
USER node

EXPOSE 3000

CMD ["npm", "start"]
