# syntax=docker/dockerfile:1
FROM node:16-alpine

# Install requirements
RUN npm install --global npm

# Install make
RUN apk add make

# copy code
WORKDIR /
ADD . /content-server/
WORKDIR content-server

# install requirements etc.
RUN npm install
WORKDIR backend
RUN npm install

CMD npm run backend-dev

