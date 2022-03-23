# syntax=docker/dockerfile:1
FROM python:3.10.2-alpine

# make git access token as environment variable available
ARG git_access_token=""
RUN echo git_access_token=${git_access_token} > git_access_token
ENV GIT_ACCESS_TOKEN ${git_access_token}

# Install requirements
RUN apk add git make yarn npm
RUN npm install --global gulp-cli

# copy code
WORKDIR /
ADD . /content-server/
WORKDIR content-server

RUN make all


