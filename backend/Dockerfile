# Playwright base image ships Chromium + all system libs, pinned to the same
# version as the `playwright` npm dependency (must stay in sync).
FROM mcr.microsoft.com/playwright:v1.59.1-jammy

WORKDIR /app

ENV NODE_ENV=production
# Browsers are already in the base image at /ms-playwright — don't re-download.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Install deps first for better layer caching. prisma/ is needed because the
# postinstall hook runs `prisma generate`.
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --include=dev

# Build the TypeScript sources.
COPY . .
RUN npm run build

# Railway injects PORT at runtime; app listens on env.PORT.
EXPOSE 8080

# start = init-db (tsx) + prisma db push + node dist/server.js.
# tsx and prisma CLI come from devDependencies, so we keep them installed.
CMD ["npm", "run", "start"]
