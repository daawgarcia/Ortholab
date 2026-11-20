# Ortholab 2 — imagem única: backend (Fastify) + frontend (build estático servido pelo Caddy)
FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY packages/backend/package.json packages/backend/
COPY packages/frontend/package.json packages/frontend/
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY packages ./packages
RUN cd packages/backend && npx prisma generate --schema=prisma/schema.prisma && npm run build
# Frontend chama a API no mesmo domínio (o Caddy encaminha /api para o backend)
ARG VITE_API_URL=https://ortholab2.estheticaligner.com.br
RUN cd packages/frontend && VITE_API_URL=$VITE_API_URL npm run build

FROM node:20-bookworm-slim AS backend
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/backend ./packages/backend
WORKDIR /app/packages/backend
EXPOSE 3001
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/server.js"]

FROM caddy:2-alpine AS web
COPY --from=build /app/packages/frontend/dist /srv
COPY deploy/Caddyfile /etc/caddy/Caddyfile
