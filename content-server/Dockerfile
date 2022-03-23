# syntax=docker/dockerfile:1
FROM python:3.10.2-alpine

# make git access token as environment variable available
ARG git_access_token=""
RUN echo git_access_token=${git_access_token} > git_access_token
ENV GIT_ACCESS_TOKEN ${git_access_token}

# Install requirements
RUN apk add git

RUN echo ${GIT_ACCESS_TOKEN}
RUN git clone --single-branch --branch main --recursive https://${GIT_ACCESS_TOKEN}:${GIT_ACCESS_TOKEN}@git.ukp.informatik.tu-darmstadt.de/zyska/peer.git peer
WORKDIR peer/content-server
RUN make all


