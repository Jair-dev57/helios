FROM node:22-alpine AS build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# La API se sirve en el mismo dominio bajo /api (nginx la reenvia al backend)
ENV VITE_API_URL=/api
RUN pnpm build

FROM nginx:alpine
# La imagen de nginx reemplaza ${BACKEND_URL} en las plantillas al arrancar
COPY default.conf.template /etc/nginx/templates/default.conf.template
ENV BACKEND_URL=http://backend:8000
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
