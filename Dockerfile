# =========================================
# Multi-stage Dockerfile for Freelance AI Suite
# =========================================

FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json* ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/
RUN npm install --no-audit --no-fund

FROM deps AS build
COPY . .
RUN npm run build -w shared
RUN npm run build -w server
RUN npm run build -w client

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache python3 make g++ \
  && mkdir -p /app/data

COPY --from=build /app/package.json ./
COPY --from=build /app/shared ./shared
COPY --from=build /app/server ./server
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/node_modules ./node_modules

EXPOSE 4000
CMD ["node", "server/dist/index.js"]
