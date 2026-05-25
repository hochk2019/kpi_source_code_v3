FROM node:20-bookworm-slim

WORKDIR /app

# better-sqlite3 needs native build tooling during install/rebuild.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Build frontend assets for production.
RUN pnpm build

ENV NODE_ENV=production
ENV PORT=5000
ENV KPI_LISTEN_HOST=0.0.0.0

EXPOSE 5000

CMD ["pnpm", "start"]
