FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
COPY tsconfig.json ./
COPY eslint.config.js ./

RUN npm run build
RUN chown -R node:node /app

EXPOSE 4000

USER node

CMD ["npm", "run", "start"]
