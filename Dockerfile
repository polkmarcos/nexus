FROM mcr.microsoft.com/playwright:v1.49.0-noble

# Set working directory
WORKDIR /app

# Install system compilation dependencies for better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy package files for both root and server
COPY package*.json ./
COPY server/package*.json ./server/

# Remove postinstall script from root package.json to prevent recursive installs
RUN npm pkg delete scripts.postinstall

# Install dependencies for root (this runs lifecycle scripts for Vite/Rolldown native bindings)
RUN npm install

# Install server dependencies (this compiles better-sqlite3)
RUN npm --prefix server install

# Copy the rest of the application code
COPY . .

# Build the Vite frontend static files
RUN npm run build

# Expose server port (Railway overrides this, but good practice)
EXPOSE 3001

# Start the application
CMD ["npm", "start"]
