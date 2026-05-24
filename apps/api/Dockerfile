FROM node:22-alpine AS base
WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/whatsapp-cloud/package.json packages/whatsapp-cloud/package.json
COPY packages/whatsapp-baileys/package.json packages/whatsapp-baileys/package.json
COPY packages/email-engine/package.json packages/email-engine/package.json

RUN npm ci

COPY . .

ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npm --workspace @oumar/api run db:generate
RUN npm run build

EXPOSE 4000

CMD ["npm", "--workspace", "@oumar/api", "run", "start"]
