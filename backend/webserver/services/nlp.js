const {io: io_client} = require("socket.io-client");
const Service = require("../Service.js");
const {getSetting} = require("../../db/methods/settings.js");

/**
 * Hold connection and data for external NLP service
 *
 * @class
 * @author Dennis Zyska
 * @classdesc A service that connects to an external NLP service via socket.io.
 * @extends Service
 */
module.exports = class NLPService extends Service {
    constructor(server) {
        super(server);

        this.connections = {};
        this.info = [];


    }

    init() {
        //... nothing to do
    }

    #setupConnectionToNlpService(client){
        // needed for callbacks using "this", as the this pointer changes by context
        // see https://stackoverflow.com/questions/20279484/how-to-access-the-correct-this-inside-a-callback
        let self = this;
        const clientId = client.socket.id;
        const toClient = client.socket;

        if (process.env.NLP_USE === "false") {
            self.logger.info("NLP is deactivated! Change NLP_USE environment variable and restart if needed.");
            return;
        }

        let socket = io_client(getSetting("service.nlp.url"),
            {
                auth: {token: getSetting("service.nlp.token")},
                reconnection: true,
                autoConnect: true,
                timeout: getSetting("service.nlp.timeout"), //timeout between connection attempts
            }
        );
        self.connections[clientId] = [socket, client, true];

        // Handle connection errors
        socket.on("connect_error", () => {
            self.logger.error("Connection error, try to connect again...");
            setTimeout(() => {
                socket.connect();
            }, getSetting("service.nlp.retryDelay"));
        });

        // Handle reconnection attempts
        socket.on("reconnection_attempt", () => {
            self.logger.error("Reconnection attempt...");
        });

        // establishing a connection
        socket.on("connect", function () {
            self.logger.info(`Connection to NLP server established: ${socket.connected}`);
            self.connections[clientId][2] = true;

            // if connection established, get information about the NLP Service
            socket.emit("skillGetAll");
        });

        // deal with broken connection
        socket.on("disconnect", function () {
            self.logger.info(`Connection to NLP server disrupted: ${!socket.connected}`);
            self.connections[clientId][2] = false;
        });

        // forwarding NLP server messages to frontend
        socket.onAny((msg, data) => {
            self.logger.info(`Message NLP SERVER -> FRONTEND: nlp_${msg} = ${data}`);
            toClient.emit("nlp_" + msg, data);
        });

        // forwarding frontend messages to NLP server
        toClient.onAny((msg, data) => {
            if(!msg.startsWith("nlp_")){
                return;
            }

            if (self.connections[clientId][2]) {
                const rmsg = msg.slice("nlp_".length);
                if(data !== undefined){
                    socket.emit(rmsg, data);
                } else {
                    socket.emit(rmsg);
                }

                self.logger.info(`Message FRONTEND -> NLP SERVER: ${rmsg}: ${data}`);
            } else {
                toClient.emit("nlp_error", "Connection to NLP server disrupted.");
                self.logger.info(`Connection to NLP server disrupted on msg ${msg}`);
            }
        });
    }

    #teardownConnectionToNlpService(client) {
        this.connections[client.socket.id][0].disconnect();

        delete this.connections[client.socket.id];
    }

    getInfo() {
        return this.info;
    }

    connectClient(client, data) {
        if (process.env.NLP_USE === "false") {
            return;
        }

        this.#setupConnectionToNlpService(client);
    }

    disconnectClient(client, data) {
        if (process.env.NLP_USE === "false") {
            return;
        }

        this.#teardownConnectionToNlpService(client);
    }
}