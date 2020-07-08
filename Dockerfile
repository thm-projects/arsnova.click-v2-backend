FROM node:12.14-alpine as build

ARG PUPPETEER_SKIP_CHROMIUM_DOWNLOAD
ARG CHROMIUM_PATH

RUN set -e \
    && apk update \
    && apk upgrade \
    && apk add --no-cache \
    udev \
    chromium \
    ttf-freefont \
    python3 \
    make

WORKDIR /usr/src/app
COPY . .
RUN npm install \
    && npm run build:DEV
WORKDIR /usr/src/app/dist

RUN echo "Building unique version hash for the build"
RUN HASH=$(date | md5sum | head -c32)
RUN sed -i s/__VERSION__/$HASH/ config.json

CMD ["node", "main.js"]
