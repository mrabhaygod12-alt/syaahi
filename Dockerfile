FROM node:24-bookworm-slim AS app
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright
COPY package.json package-lock.json ./
RUN npm ci && npx playwright install --with-deps chromium
COPY . .
RUN npm run build && chown -R node:node /app /opt/playwright
USER node
ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000
CMD ["sh", "-c", "npm run start -- --hostname 0.0.0.0 --port ${PORT}"]
