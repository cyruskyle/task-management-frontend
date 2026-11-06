FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.29-alpine
ENV API_UPSTREAM=http://app:8080
ENV NGINX_ENVSUBST_FILTER=^API_UPSTREAM$
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

USER 101
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
