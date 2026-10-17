FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_GA_ID=
ENV NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Runtime-only dependencies for the migrate/scraper tool images: no eslint,
# typescript, drizzle-kit, tailwind etc. (tsx is a runtime dependency).
FROM node:22-bookworm-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM node:22-bookworm-slim AS migrator
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY scripts ./scripts
COPY drizzle ./drizzle
CMD ["npm", "run", "migrate"]

FROM node:22-bookworm-slim AS scraper
WORKDIR /app
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
COPY --from=prod-deps /app/node_modules ./node_modules
# Every scraper launches chromium with headless: true, so the headless shell is
# enough: --only-shell skips the full headed Chromium build (the bulk of the
# old 3.48G image). Only chromium, no firefox/webkit; apt lists dropped.
RUN npx playwright install --with-deps --only-shell chromium \
 && rm -rf /var/lib/apt/lists/* /root/.npm /tmp/*
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
