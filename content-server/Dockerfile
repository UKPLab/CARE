# syntax=docker/dockerfile:1
FROM python:3.10.2-alpine

# Install requirements
RUN apk add git make yarn npm
RUN npm install --global gulp-cli

# copy code
WORKDIR /
ADD . /content-server/
WORKDIR content-server

RUN make all
CMD make dev


