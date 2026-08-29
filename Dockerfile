FROM node:20-alpine

WORKDIR /app

# Install dependencies first so Docker can cache this layer.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

USER node
CMD ["node", "index.js"]
