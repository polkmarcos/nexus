FROM mcr.microsoft.com/playwright:v1.44.0-jammy

# Set working directory
WORKDIR /app

# Copy package files for both root and server
COPY package*.json ./
COPY server/package*.json ./server/

# Install dependencies for both root and server
RUN npm install
RUN npm --prefix server install

# Copy application code
COPY . .

# Build the Vite frontend static files
RUN npm run build

# Expose server port (Railway overrides this, but good practice)
EXPOSE 3001

# Start the application
CMD ["npm", "start"]
