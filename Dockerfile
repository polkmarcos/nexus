FROM mcr.microsoft.com/playwright:v1.44.0-jammy

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

# Install dependencies, ignoring the postinstall script initially
RUN npm install --ignore-scripts

# Install server dependencies (this compiles better-sqlite3 with the installed build tools)
RUN npm --prefix server install

# Copy the rest of the application code
COPY . .

# Build the Vite frontend static files
RUN npm run build

# Expose server port (Railway overrides this, but good practice)
EXPOSE 3001

# Start the application
CMD ["npm", "start"]
