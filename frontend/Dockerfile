# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Accept backend URL at build time (for cloud deployments)
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production
FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user
RUN addgroup --system --gid 1001 cura && adduser --system --uid 1001 cura

# Copy standalone files (extremely lightweight!)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=cura:cura /app/.next/standalone ./
COPY --from=builder --chown=cura:cura /app/.next/static ./.next/static

# Install wget for health check
RUN apk add --no-cache wget

RUN chown -R cura:cura /app
USER cura

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -q --spider http://localhost:3000 || exit 1

CMD ["node", "server.js"]
