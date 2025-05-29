# Use Node.js official image
FROM node:18-alpine

# Install curl for health checks and debugging tools
RUN apk add --no-cache curl netcat-openbsd

# Create app directory
WORKDIR /app

# Copy production package.json (without build scripts)
COPY package.docker.json ./package.json
COPY package-lock.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application (make sure to run 'npm run build' locally first)
COPY dist/ ./dist/

# Copy .env file for Docker environment
COPY .env ./.env

# Expose port for MCP inspector
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV MCP_TRANSPORT=sse
ENV PORT=3000

# Create volumes directory and set permissions
RUN mkdir -p /app/credentials /app/logs && \
    chmod 755 /app/credentials /app/logs

# Make the script executable
RUN chmod +x dist/index.js

# Health check using curl with better timeout
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Add a startup script for better logging
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'echo "🐳 Starting MCP GDrive Server in Docker..."' >> /app/start.sh && \
    echo 'echo "📊 Environment: $NODE_ENV"' >> /app/start.sh && \
    echo 'echo "🚀 Transport: $MCP_TRANSPORT"' >> /app/start.sh && \
    echo 'echo "📡 Port: $PORT"' >> /app/start.sh && \
    echo 'echo "🔗 Health: http://localhost:$PORT/health"' >> /app/start.sh && \
    echo 'echo "🔗 SSE: http://localhost:$PORT/sse"' >> /app/start.sh && \
    echo 'echo "✅ Starting server..."' >> /app/start.sh && \
    echo 'exec node dist/index.js --sse' >> /app/start.sh && \
    chmod +x /app/start.sh

# Run the startup script
CMD ["/app/start.sh"]
