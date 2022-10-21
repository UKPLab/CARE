# Backend

The backend consists of two components: the NLP server and the webserver of the
content server that bundles the connections to the third tier (NLP server and
databases) into one service, as well as hosting the frontend.

### Code Structure
```

> db                    # db modules (sequelize)

> tests                 # backend tests

> utils                 # helper functions

> webserver             # the actual webserver of the content server
>>> routes              # routes provided via express (especially authentification)
>>> sockets             # websockets of the server
>>> createServer.js     # execute this script to start the content server
>>> webServer.js        # configuration of the web server
```