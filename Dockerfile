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

# Build args
ARG NEXTAUTH_SECRET
ARG NEXTAUTH_URL

# Create env file for build
RUN echo "NEXTAUTH_SECRET=${NEXTAUTH_SECRET}" > .env.production && \
    echo "NEXTAUTH_URL=${NEXTAUTH_URL}" >> .env.production

# Build the application
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

# Build args as runtime env
ARG NEXTAUTH_URL
ENV NEXTAUTH_URL=${NEXTAUTH_URL}

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
