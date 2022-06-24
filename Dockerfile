# syntax=docker/dockerfile:1
FROM node:16-alpine

# Install requirements
RUN npm install --global npm gulp-cli

# copy code
WORKDIR /
ADD . /content-server/
WORKDIR content-server

CMD make dev


