FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

ENV FRAPPE_WEB_ORIGIN=http://frappe:8000
ENV FRAPPE_SOCKETIO_ORIGIN=http://frappe:9000
ENV SSO_GATEWAY_ORIGIN=http://sso-gateway:4000

COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
