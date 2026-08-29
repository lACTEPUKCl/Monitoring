FROM node:22-alpine

COPY . /app

WORKDIR /app
RUN npm ci --omit=dev
CMD [ "node", "index.js" ]

