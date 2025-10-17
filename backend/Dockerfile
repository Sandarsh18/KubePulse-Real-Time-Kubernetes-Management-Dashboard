# backend Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN npm install --production --legacy-peer-deps || yarn install --production || pnpm install --prod
COPY . .
EXPOSE 8080
CMD ["node","src/server.js"]
