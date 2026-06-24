# syntax=docker/dockerfile:1

# ---------- Stage 1: build the React + Vite frontend ----------
FROM node:20-slim AS frontend
WORKDIR /app/frontend
COPY src/frontend/package*.json ./
RUN npm install
COPY src/frontend/ ./
RUN npm run build          # outputs /app/frontend/dist

# ---------- Stage 2: backend runtime (serves API + built UI) ----------
FROM node:20-slim AS runtime
WORKDIR /app/backend
COPY src/backend/package*.json ./
RUN npm install
COPY src/backend/ ./
# Express serves ../public (resolves to /app/backend/public) — put the built UI there
COPY --from=frontend /app/frontend/dist ./public
ENV PORT=8000
EXPOSE 8000
CMD ["npm", "start"]