FROM node:18-bookworm-slim AS deps
WORKDIR /app
ENV SKIP_DB_SETUP=1
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM node:18-bookworm-slim AS builder
WORKDIR /app
ENV SKIP_DB_SETUP=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run postinstall
RUN npx prisma generate
RUN npm run build

FROM node:18-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules ./node_modules
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
