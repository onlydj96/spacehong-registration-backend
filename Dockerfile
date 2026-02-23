FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:22-alpine
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && \
    adduser -S expressuser -u 1001
COPY --from=builder /app/node_modules ./node_modules
COPY . .
RUN rm -f .env .env.* Dockerfile .dockerignore
USER expressuser
EXPOSE 4000
ENV NODE_ENV=production
CMD ["node", "server.js"]
