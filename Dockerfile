FROM node:20-alpine
RUN apk add --no-cache aws-cli bash
RUN npm install -g pnpm
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/backend/package.json ./packages/backend/package.json
COPY packages/frontend/package.json ./packages/frontend/package.json
RUN pnpm install --no-frozen-lockfile
COPY packages/backend ./packages/backend
COPY scripts ./scripts
WORKDIR /app/packages/backend
EXPOSE 3000
ENTRYPOINT ["/bin/bash", "/app/scripts/docker-entrypoint.sh"]
