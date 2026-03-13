# Use official Node.js LTS image
FROM node:20-alpine

# Install dependencies for native modules (sqlite3)
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package.json first (for caching dependencies)
COPY package.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of the source code
COPY server.js ./

# Expose port for the registration service
EXPOSE 3000

# Start the Node.js service
CMD ["node", "server.js"]