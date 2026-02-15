FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate environment variables file
RUN echo "DATABASE_URL=\${DATABASE_URL}" > .env.production && \
    echo "NEXTAUTH_SECRET=\${NEXTAUTH_SECRET}" >> .env.production && \
    echo "NEXTAUTH_URL=\${NEXTAUTH_URL}" >> .env.production && \
    echo "N8N_BASE_URL=\${N8N_BASE_URL}" >> .env.production && \
    echo "N8N_WEBHOOK_BUSCA_URL=\${N8N_WEBHOOK_BUSCA_URL}" >> .env.production && \
    echo "N8N_WEBHOOK_ANALISE_URL=\${N8N_WEBHOOK_ANALISE_URL}" >> .env.production && \
    echo "N8N_WEBHOOK_SECRET=\${N8N_WEBHOOK_SECRET}" >> .env.production && \
    echo "CRON_SECRET=\${CRON_SECRET}" >> .env.production && \
    echo "OPENROUTER_API_KEY=\${OPENROUTER_API_KEY}" >> .env.production

# Build the application
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
