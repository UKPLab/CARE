# syntax=docker/dockerfile:1
FROM node:20.18.1-alpine
ARG ENV
ENV ENV=$ENV

# Install requirements
RUN npm install --global npm

# Install make
RUN apk add make

# Install msmtp (for sending emails)
RUN apk add --no-cache msmtp
# Link msmtp as sendmail
RUN ln -sf /usr/bin/msmtp /usr/sbin/sendmail

# copy code
WORKDIR /
ADD . /content-server/
WORKDIR content-server

# Run initialization
RUN echo $ENV
RUN make ENV=$ENV build-frontend

CMD ["sh", "-c", "make ENV=$ENV NODE_ENV=production init dev-backend"]
