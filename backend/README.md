# Backend

The backend consists of two components: the NLP server and the webserver of the
content server that bundles the connections to the third tier (NLP server and
databases) into one service, as well as hosting the frontend.

## NLP Server
See README in directory nlp.

## Content Server

The content server provides document and user management and connects the h
client, h server and NLP server. It provides the Vue.js front-end and a
very reduced API for access to the databases etc. It acts as a mediator between
the frontend websocket and the h server websockets.

### Code Structure
```
> tools                 # standalone modules for management tasks (e.g. DBs)

> templates             # mustache templates of pages provided through the content server

> webserver             # the actual webserver of the content server
>>> routes              # routes provided via express
>>> sockets             # websockets of the server
>>> createServer.js     # execute this script to start the content server
>>> webServer.js        # configuration of the web server

> nlp                   # server and all files of the NLP server
```

## Service Architecture

TODO: Add how the components (content + nlp server) interact.