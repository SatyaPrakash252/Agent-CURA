# Stage 1: Build the Next.js application
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy application source code
COPY . .

# Build Next.js app
RUN npm run build

# Stage 2: Serve the application in production mode
FROM node:18-alpine AS runner

WORKDIR /app

# Configure Next.js environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy necessary build outputs and dependency files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next

# Expose Next.js port
EXPOSE 3000

# Start production server
CMD ["npm", "run", "start"]
