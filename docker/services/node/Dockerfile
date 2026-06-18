FROM node:24

WORKDIR /project

RUN corepack enable && corepack prepare yarn@4.13.0 --activate \
  && mkdir -p /home/node/.cache/node \
  && cp -a /root/.cache/node/corepack /home/node/.cache/node/corepack \
  && chown -R node:node /home/node/.cache
