FROM node:20-alpine AS builder

# better-sqlite3 native build uchun
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Dev dep larni olib tashlash
RUN npm prune --omit=dev


FROM node:20-alpine AS runner

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

RUN mkdir -p data

VOLUME /app/data

CMD ["node", "dist/index.js"]
