FROM node:20-bullseye-slim

# Install system dependencies (minimal)
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

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
