# syntax=docker/dockerfile:1
FROM node:20.6-alpine
ARG ENV
ENV ENV=$ENV

# Install requirements
RUN npm install --global npm

# Install make
RUN apk add make

# copy code
WORKDIR /
ADD . /content-server/
WORKDIR content-server

# Run initialization
RUN echo $ENV
RUN make ENV=$ENV build-frontend

CMD ["sh", "-c", "make ENV=$ENV NODE_ENV=production init dev-backend"]
