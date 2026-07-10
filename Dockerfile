# ---- deps: install node_modules (build tools for better-sqlite3) ----
FROM node:26-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
    python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: compile the standalone Next.js server ----
FROM node:26-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runner: minimal production image ----
FROM node:26-bookworm-slim AS runner
WORKDIR /app
# Apply the latest OS security patches on top of the base image (runs as root).
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*
# Baked in by CI (see .github/workflows/docker-publish.yml); "unknown" for
# local/manual builds. Shown on the in-app About page.
ARG GIT_SHA=unknown
ARG BUILD_DATE=unknown
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_PATH=/data/asocial.db \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    GIT_SHA=$GIT_SHA \
    BUILD_DATE=$BUILD_DATE

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Runtime migrations + locale messages (dynamically imported)
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/messages ./messages

RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME /data
EXPOSE 3000

CMD ["node", "server.js"]
