Adding a Service
=======================

You can couple any external, event-based service into the infrastructure of CARE; e.g. you may couple your own data
processing pipeline or even a search query interface. Read this chapter to learn how to add your own services and
couple the frontend to them.

.. note::

    Do not use this mechanism for coupling NLP models, as we already provide a ready-to-use service with a flexible
    API for this purpose. Check out the :doc:`For Researchers <../../for_researchers/basics>` chapter for more details on how
    to couple your own models.

The Service Architecture in CARE
--------------------------------
The service architecture is realized in the backend; in the following all paths are provided relative to the
directory ``backend/webserver`` including all relevant components.

During start-up of the webserver all services specified in the ``services`` directory are loaded. Each service is
specified in an individual ``.js``-file exporting a class that extends the ``Service`` base class. Hence, adding
a service means creating such a new file and overriding the abstract class.

This base class (specified in ``Service.js``) defines the interface methods towards the frontend clients that you can
use and override for your specific purpose. In the following sections we elaborate which methods and attributes
you should use or override to realize your own service. Conceptually, for each client a socket connection permits the
communication with a service through a pre-defined message interface, while the service may respond to each client
individually or broadcast messages.

This architectural patterns decouples the core code base from additional services. Generally, the service logic in the
backend should be kept lean and with low computational requirements; instead, the necessary data and requests should
be forwarded to an external service that carries the computational load.


Adding a New Service Class
--------------------------
Let's say we want to add a new service called ``Test`` to CARE. First, we add a new file ``test.js`` to the
``backend/webserver/services`` directory that exports the new service class :

.. code-block:: javascript

    /**
     * <documentation>
     */
    module.exports = class TestService extends Service {
        constructor(server) {
            super(server);
        }
    }

That's it! From now on the test service will be loaded by the webserver on start-up. While it is not functional
yet, you could already re-start the webserver and have it running and reachable from the frontend.
We add the actual functionality now.


Adding a Dummy Service for Testing
----------------------------------
The frontend clients communicate with all services via the service socket (``backend/webserver/sockets/service.js``),
which realizes the routing of messages to the different services depending on the client-provided service name. A service
may receive four types of messages from clients (connect, disconnect, request, command) and may respond to them.

We first need to extend the ``TestService`` to process incoming requests and commands. Requests by clients are the standard
message for requesting a simple result in the style of a remote procedure call of one predefined function. For a simple
stateless service this is the most important message type. To allow for more complex and stateful services, clients may
also send commands that may be used to realize different function calls.

In the following code example, we respond to client requests and commands by a dummy response. For the broadcast
command, we broadcast a dummy response to all connected clients.

.. code-block:: javascript

    /**
     * <documentation>
     */
    module.exports = class TestService extends Service {
        constructor(server) {
            super(server);
        }

        close() {
            // called by the server on shut-down, add any teardown logic here -- not necessary here
        }

        connectClient(client, data) {
            // no need to store anything for this service
        }

        disconnectClient(client, data) {
            // no need to delete anything upon disconnect
        }

        request(client, data) {
            this.send(client, "dummyResult", {success: True, msg: "dummy"});
        }

        command(client, command, data) {
            if(command === "broadcast"){
                this.sendAll("dummyResult", {success: True, msg: "dummy broadcast"});
            }
        }
    }

After restarting the server, we could already send service request messages to this service.

.. note::

    Please refer to the API documentation for the details of the message format of requesting a service. Also
    checkout the :doc:`examples <./examples>` for a reference on how to reach a service from the frontend.


Coupling an External Service (Forwarding)
------------------------------------------

By the described paradigm, the service class should be kept lean and without high computational demands. To realize
complex computation, you should couple an external service. In principle, you can connect any service as long as
you add the required communication logic to your service class. We highly recommend using web sockets, as they are
used throughout the rest of the CARE tool.

Realizing forwarding of client messages using websockets is quite simple. You first need to open a client socket
towards your web server running a socketio server and then you cache and forward all client requests to through
this client.

.. note::

    For an example on how to realize the socketio server in Python on the other end of the service, please refer
    to the repository of NLP broker, which uses flask and socketio to realize this functionality.

To implement this, we initialize a connection to the external service and listen on result messages. We assume
that we provide client Ids that are copied for the response by the external service. We forward messages by the
clients directly to the service replacing the dummy logic.

The given example implements no mechanisms for error recovery or connection issues and should serve only as a
starting point.

.. code-block:: javascript

    /**
     * <documentation>
     */
    module.exports = class TestService extends Service {
        constructor(server) {
            super(server);
            this.toService = null;

            #init();
        }

        #init(){
            const self = this;

            self.toService = io_client("http://localhost:1234",
                {
                    auth: {token: "random_token"},
                    reconnection: true,
                    timeout: 5000, //timeout between connection attempts
                }
            );
            self.toService.on("result", (data) => {
                const client = self.#getClient(data.clientId);
                delete data.clientId;
                self.send(client, "result", data);
            });
        }

        #getClient(clientId) {
            return this.server.availSockets[clientId]["ServiceSocket"];
        }

        close() {
            if(this.toService){
                this.toService.disconnect();
            }
        }

        request(client, data) {
            data["clientId"] = client.socket.id;
            this.toService.emit("request", data);
        }

        //... other methods ommitted for brevity
    }

This completes the extension of CARE by a new service called Test forwarding requests to the an external service
running on localhost.