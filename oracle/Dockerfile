# Stage 1: install dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: dev workspace (source mounted at runtime)
FROM deps AS dev
WORKDIR /app
COPY tsconfig.json vitest.config.ts ./
ENTRYPOINT ["npx"]
CMD ["vitest", "run"]
