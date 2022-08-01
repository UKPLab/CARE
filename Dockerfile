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

# Run initialization
RUN make ENV=build dev-build-frontend

CMD make ENV=build init dev-backend
