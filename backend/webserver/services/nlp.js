const {io: io_client} = require("socket.io-client");
const Service = require("../Service.js");

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

        this.socket = null;
        this.info = [];
        this.connected = false;
    }

    init() {
        // needed for callbacks using "this", as the this pointer changes by context
        // see https://stackoverflow.com/questions/20279484/how-to-access-the-correct-this-inside-a-callback
        let self = this;

        self.socket = io_client(process.env.NLP_SERVICE,
            {
                auth: {token: process.env.NLP_ACCESS_TOKEN},
                reconnection: true,
                autoConnect: (process.env.NLP_USE !== "false"),
                timeout: 10000, //timeout between connection attempts
            }
        );

        if (process.env.NLP_USE === "false") {
            self.logger.info("NLP is deactivated! Change NLP_USE environment variable and restart if needed.");
            return;
        }

        // Handle connection errors
        self.socket.on("connect_error", () => {
            self.logger.error("Connection error, try to connect again...");
            setTimeout(() => {
                self.socket.connect();
            }, 10000);
        });

        // Handle reconnection attempts
        self.socket.on("reconnection_attempt", () => {
            self.logger.error("Reconnection attempt...");
        });

        // establishing a connection
        self.socket.on("connect", function () {
            self.logger.info(`Connection to NLP server established: ${self.socket.connected}`);
            self.connected = true;

            // if connection established, get information about the NLP Service
            self.socket.emit("skillGetAll");
        });

        // deal with broken connection
        self.socket.on("disconnect", function () {
            self.logger.info(`Connection to NLP server disrupted: ${!self.socket.connected}`);
            self.connected = false;
        });

        // cache skillUpdate messages
        self.socket.on("skillUpdate", (data) => {
            self.logger.info(`Available skills: ${data.map(e => e.name)}`);
            self.info = data;
        });

        // forwarding NLP server messages to frontend
        self.socket.onAny((msg, data) => {
            self.logger.info(`Message NLP SERVER -> FRONTEND: nlp_${msg} = ${data}`);
            self.server.io.emit("nlp_" + msg, data);
        });

        // forwarding frontend messages to NLP server
        self.server.io.on("nlp_*", (msg, data) => {
            if (self.connected) {
                self.socket.emit(msg.slice("nlp_".length).replace("_", "/"), data);
                self.logger.info(`Message FRONTEND -> NLP SERVER: ${msg}`);
            } else if (!self.connected) {
                self.server.io.emit("nlp_error", "Connection to NLP server disrupted.");
                self.logger.info(`Connection to NLP server disrupted on msg ${msg}: ${!self.connected}`);
            }
        });

    }

    get_info() {
        return this.info;
    }

    disconnect() {
        if (process.env.NLP_USE === "false") {
            return;
        }
        this.socket.disconnect();
    }

    connect() {
        if (process.env.NLP_USE === "false") {
            return;
        }
        this.socket.connect();
    }


}