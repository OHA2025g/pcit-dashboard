FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --network-timeout 600000
COPY . .
# Empty = same origin; nginx below forwards /api to the backend container.
ENV REACT_APP_BACKEND_URL=""
ENV DISABLE_EMERGENT_OVERLAY=true
RUN rm -f .env && yarn build

FROM alpine:latest
RUN apk add --no-cache nginx \
 && mkdir -p /run/nginx /usr/share/nginx/html \
 && rm -f /etc/nginx/http.d/default.conf
COPY nginx.conf /etc/nginx/http.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
