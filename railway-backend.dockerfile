# This Dockerfile is designed to build the backend from the REPOSITORY ROOT.
# Use this if you cannot set the Root Directory to /backend in Railway.

FROM node:20-bookworm-slim AS deps
WORKDIR /app

# Copy backend dependencies from the backend/ directory
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

FROM deps AS build
# Copy backend source code
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# Verify we are using this Dockerfile
RUN echo "============== BUILDING WITH RAILWAY-BACKEND.DOCKERFILE =============="

FROM node:20-bookworm-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

# Copy dependencies and build artifacts
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# Copy package.json to ensure runtime scripts work if needed
COPY backend/package.json ./

EXPOSE 5000
CMD ["npm", "start"]
