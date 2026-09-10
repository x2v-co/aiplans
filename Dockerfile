FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_GA_ID=
ENV NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM deps AS migrator
WORKDIR /app
COPY package.json tsconfig.json ./
COPY scripts ./scripts
CMD ["npm", "run", "migrate"]

FROM deps AS scraper
WORKDIR /app
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install --with-deps chromium
COPY package.json tsconfig.json ./
COPY scripts ./scripts
# Scripts share selectors with the app (e.g. src/lib/plan-selector.ts, used by
# fix:kinds / mappings:materialize / audit); copying scripts alone made those
# commands crash in-container from 2026-08-20 until the drift was spotted.
COPY src ./src
CMD ["npm", "run", "scrape"]

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
