# Multi-stage build for Vite app (npm/yarn/pnpm supported)

FROM node:22-alpine AS builder
WORKDIR /app

# Build-time env for Vite
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Copy package files
COPY package*.json ./

# Enable corepack and install with yarn
RUN corepack enable && yarn install

# Copy source
COPY . .

# Build
RUN yarn build

# Production image
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built app
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
