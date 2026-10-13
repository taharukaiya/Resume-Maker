FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY . .
RUN BRILLIANCY_SMALL_BUILD=true NODE_OPTIONS=--max-old-space-size=1536 npm run build

FROM base AS production-dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM base AS runtime
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && curl -fsSL https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -o /app/rds-ca.pem && apt-get purge -y curl && rm -rf /var/lib/apt/lists/* && groupadd --system --gid 1001 app && useradd --system --uid 1001 --gid app app
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/tsconfig.json ./tsconfig.json
RUN mkdir -p /app/.next/cache /data && chown -R app:app /app/.next/cache /data
USER app
EXPOSE 3000
CMD ["node","server.js"]
