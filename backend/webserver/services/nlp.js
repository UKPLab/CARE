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

        this.info = null;
        this.timer = null;

        this.toNlpSocket = null;
    }

    init() {
        if (process.env.NLP_USE === "false") {
            this.logger.info("NLP is deactivated! Change NLP_USE environment variable and restart if needed.");
            return;
        }

        //connect
        this.connect();

        //setup timer to periodically clean the info cache
        const self = this;
        self.info = null;

        this.timer = setInterval(() => {
            self.info = null;
        }, 300*1000);
    }

    getInfo() {
        return this.info;
    }

    isConnected() {
        return this.toNlpSocket !== null && this.toNlpSocket.connected;
    }

    connect() {
        const self = this;

        self.toNlpSocket = io_client(process.env.NLP_SERVICE,
            {
                auth: {token: process.env.NLP_ACCESS_TOKEN},
                reconnection: true,
                autoConnect: (process.env.NLP_USE !== "false"),
                timeout: 10000, //timeout between connection attempts
            }
        );

        // Handle connection errors
        self.toNlpSocket.on("connect_error", () => {
            self.logger.error("Connection error, try to connect again...");
            setTimeout(() => {
                self.toNlpSocket.connect();
            }, 10000);
        });

        // Handle reconnection attempts
        self.toNlpSocket.on("reconnection_attempt", () => {
            self.logger.error("Reconnection attempt...");
        });

        // establishing a connection
        self.toNlpSocket.on("connect", function () {
            self.logger.info(`Connection to NLP server established: ${self.toNlpSocket.connected}`);

            // if connection established, get information about the NLP Service
            self.toNlpSocket.emit("skillGetAll", {});
        });

        // deal with broken connection
        self.toNlpSocket.on("disconnect", function () {
            self.logger.info(`Connection to NLP server disrupted: ${!self.toNlpSocket.connected}`);
        });

        // forwarding NLP server messages to frontend
        self.toNlpSocket.onAny((msg, data) => {
            // store skillUpdate data
            if(msg === "skillUpdate" && self.info !== data){
                //deep copy (otherwise info becomes undefined)
                const up = JSON.parse(JSON.stringify(data.data));
                if(self.info !== null){
                    const upSkills = up.map(s => s.name);
                    self.info = self.info.filter(e => !upSkills.includes(e.name));
                    self.info = self.info.concat(up.filter(s => s.nodes > 0));
                } else {
                    self.info = up;
                }

                self.server.io.emit("nlp_skillUpdate", self.info);
                return;
            }

            const cid = NLPService.#extractClientId(data);
            const toClientSocket = self.server.availSockets[cid]["NLPSocket"].socket;

            toClientSocket.emit("nlp_" + msg, {id: data.id ? data.id : null, data: data.data});
        });
    }

    request(msg, data, cid){
        if(msg === "skillGetAll" && this.info !== null){
            const toClientSocket = this.server.availSockets[cid]["NLPSocket"].socket;

            toClientSocket.emit("nlp_skillUpdate", this.info);
        }

        this.toNlpSocket.emit(msg, {clientId: cid, clientSecret: null, data: data ? data : null});
    }

    cancelTimer() {
        if(this.timer){
            clearInterval(this.timer);
        }
    }

    static #extractClientId(data){
        return data.clientId ? data.clientId : null;
    }
}