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
        this.info = null;
        this.connected = false;
    }

    init() {
        this.socket = io_client(process.env.NLP_SERVICE,
            {
                query: {token: process.env.NLP_ACCESS_TOKEN},
                // Query is available under socket.handshake.query in server
                reconnection: true,
                autoConnect: (process.env.NLP_USE !== "false"),
                timeout: 10000, //timeout between connection attempts
            }
        );

        if (process.env.NLP_USE === "false") {
            return;
        }

        // Handle connection errors
        this.socket.on("connect_error", () => {
            this.logger.error("Connection error, try to connect again...");
            setTimeout(() => {
                this.socket.connect();
            }, 10000);
        });

        // Handle reconnection attempts
        this.socket.on("reconnection_attempt", () => {
            this.logger.error("Reconnection attempt...");
        });

        // establishing a connection
        this.socket.on("connect", function () {
            this.logger.info(`Connection to NLP server established: ${this.socket.connected}`);
            this.connected = true;

            // if connection established, get information about the NLP Service
            this.socket.emit("get_info");
        });

        // deal with broken connection
        this.socket.on("disconnect", function () {
            this.logger.info(`Connection to NLP server disrupted: ${!this.socket.connected}`);
            this.connected = false;
        });

        this.socket.on("info", (data) => {
            this.logger.info(`NLP Service: ${data.name} (${data.version})`);
            this.info = data;
        });

        // TODO: one of the sockets are wrong! should send to Frontend not to NLP
        // we should get this through this.server.io

        // forwarding NLP server messages to frontend
        this.socket.onAny((msg, data) => {
            this.socket.emit("nlp_" + msg.replace("/", "_"), data);
            this.logger.info(`Message NLP SERVER -> FRONTEND: nlp_${msg} ${data}`);
        });

        // forwarding frontend messages to NLP server
        this.socket.onAny((msg, data) => {
            if (msg.startsWith("nlp_") && this.connected) {
                this.socket.emit(msg.slice("nlp_".length).replace("_", "/"), data);
                this.logger.info(`Message FRONTEND -> NLP SERVER: ${msg}`);
            } else if (msg.startsWith("nlp_") && !this.connected) {
                this.socket.emit("nlp_error", "Connection to NLP server disrupted.");
                this.logger.info(`Connection to NLP server disrupted on msg ${msg}: ${!this.connected}`);
                if (msg.startsWith("nlp_")) {
                    this.socket.emit(msg, data)
                }
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