# Backend Dockerfile for FishChain
FROM node:20-alpine

WORKDIR /usr/src/app

# Install dependencies first, then copy app sources for better caching
COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 8080

CMD ["node", "app.js"]
