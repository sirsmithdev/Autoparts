# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root and client package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install all dependencies (including dev) for building
RUN npm install && cd client && npm install

# Copy source code
COPY . .

# Reinstall esbuild to get correct binary for Alpine Linux
RUN npm rebuild esbuild

# Build the application
# CACHEBUST arg invalidates Docker layer cache for the build step when needed
ARG CACHEBUST=1
ARG NEXT_PUBLIC_TWS_KEY
ENV NEXT_PUBLIC_TWS_KEY=${NEXT_PUBLIC_TWS_KEY}
RUN npm run build:server && cd client && npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Copy root and client package files, install production deps
COPY package*.json ./
COPY client/package*.json ./client/
RUN npm install --omit=dev --ignore-scripts && \
    cd client && npm install --omit=dev --ignore-scripts && \
    npm cache clean --force

# Copy built server from builder
COPY --from=builder /app/dist ./dist

# Copy migration files (including meta/) and runner script
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/scripts ./scripts

# Copy built Next.js app from builder
COPY --from=builder /app/client/.next ./client/.next
COPY --from=builder /app/client/public ./client/public

# Copy Next.js config (needed at runtime for basePath)
COPY --from=builder /app/client/next.config.ts ./client/next.config.ts

# Set ownership to non-root user
RUN chown -R appuser:nodejs /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 5002

# Set environment
ENV NODE_ENV=production

# Run migrations (best-effort) then start the server
CMD ["sh", "-c", "node scripts/run-migrations.js || echo 'Migration failed - starting server anyway'; node dist/server.js"]
