FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN NODE_OPTIONS=--openssl-legacy-provider npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY backend/package.json backend/package-lock.json ./backend/
RUN npm ci --prefix backend --omit=dev

COPY backend/src ./backend/src
COPY frontend/src/gameRules.js frontend/src/bodyPhysics.js frontend/src/hazardGeometry.js frontend/src/skillBook.js ./frontend/src/
COPY --from=frontend-build /app/frontend/build ./frontend/build
COPY ENEMY_NOTES.json ./ENEMY_NOTES.json

EXPOSE 8080
CMD ["node", "backend/src/app.js"]
