FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY frontend-react/package*.json ./frontend-react/
RUN npm ci --prefix frontend-react

COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY backend ./backend
COPY --from=build /app/frontend-react/dist ./frontend-react/dist

RUN mkdir -p /app/backend/data/uploads/menu \
  && chown -R node:node /app

USER node
EXPOSE 3000
CMD ["node", "backend/server.js"]
