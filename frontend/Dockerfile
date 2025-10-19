# frontend Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN npm install --legacy-peer-deps || yarn install || pnpm install
COPY . .
# Use .env-provided VITE_API_URL (or override via build-arg). Do not hard-code /api here.
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build || yarn build || pnpm build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Use nginx-cluster.conf for in-cluster deployment (proxies to backend service)
COPY nginx-cluster.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx","-g","daemon off;"]
