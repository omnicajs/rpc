FROM node:24

WORKDIR /project

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PLAYWRIGHT_SKIP_BROWSER_GC=1

RUN corepack enable && corepack prepare yarn@4.13.0 --activate \
  && mkdir -p /home/node/.cache/node \
  && cp -a /root/.cache/node/corepack /home/node/.cache/node/corepack \
  && chown -R node:node /home/node/.cache

RUN npx -y playwright@1.61.0 install --with-deps chromium firefox
