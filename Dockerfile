# STAGE 1- build
FROM node:lts-slim as builder

WORKDIR /app

COPY package*.json ./
RUN npm i

COPY . .

RUN npm run build

# STAGE 2 - server
FROM node:lts-slim

WORKDIR /app

COPY package*.json ./
RUN npm i --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/swagger*.json ./
COPY --from=builder /app/mail ./mail
COPY --from=builder /app/public ./public

# Expose application port
EXPOSE 3000

# Start the application
CMD npm run start
