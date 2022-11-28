/* Hold connection and data for external NLP service

Author: Dennis Zyska (zyska@ukp...)
Source: --
*/
const logger = require("../../utils/logger.js")("external/nlp");
const {io: io_client} = require("socket.io-client");

class NLP_Service {
    constructor() {
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
            logger.error("Connection error, try to connect again...");
            setTimeout(() => {
                this.socket.connect();
            }, 10000);
        });

        // Handle reconnection attempts
        this.socket.on("reconnection_attempt", () => {
            logger.error("Reconnection attempt...");
        });

        // establishing a connection
        this.socket.on("connect", function () {
            logger.info(`Connection to NLP server established: ${this.socket.connected}`);
            this.connected = true;

            // if connection established, get information about the NLP Service
            this.socket.emit("get_info");
        });

        // deal with broken connection
        this.socket.on("disconnect", function () {
            logger.info(`Connection to NLP server disrupted: ${!this.socket.connected}`);
            this.connected = false;
        });

        this.socket.on("info", (data) => {
            logger.info(`NLP Service: ${data.name} (${data.version})`);
            this.info = data;
        });

        // forwarding NLP server messages to frontend
        this.socket.onAny((msg, data) => {
            this.socket.emit("nlp_" + msg.replace("/", "_"), data);
            logger.info(`Message NLP SERVER -> FRONTEND: nlp_${msg} ${data}`);
        });

        // forwarding frontend messages to NLP server
        this.socket.onAny((msg, data) => {
            if (msg.startsWith("nlp_") && this.connected) {
                this.socket.emit(msg.slice("nlp_".length).replace("_", "/"), data);
                logger.info(`Message FRONTEND -> NLP SERVER: ${msg}`);
            } else if (msg.startsWith("nlp_") && !this.connected) {
                this.socket.emit("nlp_error", "Connection to NLP server disrupted.");
                logger.info(`Connection to NLP server disrupted on msg ${msg}: ${!this.connected}`);
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

module.exports = NLP_Service;