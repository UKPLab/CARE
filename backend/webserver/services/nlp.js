const {io: io_client} = require("socket.io-client");
const Service = require("../Service.js");
const {getSetting} = require("../../db/methods/settings");
const fs = require("fs");
const path = require("path");
const yaml = require('js-yaml')

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

        this.retryDelay = 10000;
        this.info = null;
        this.timer = null;

        this.toNlpSocket = null;
        this.fallbacks = [];
    }

    loadFallbacks() {
        return fs.readdirSync(path.resolve(__dirname, "../../../files/sdf"))
            .filter(file => file.endsWith(".yaml")).map((file) => {
                   return yaml.load(fs.readFileSync(path.join(path.resolve(__dirname, "../../../files/sdf"), file), "utf8"));
            });
    }

    fallbackResponse(skill) {
        const skillConfig = this.fallbackConfig(skill)
        if (skillConfig) return skillConfig.output.example;
    }

    fallbackConfig(skill) {
        if (this.fallbacks.length > 0) {
           return this.fallbacks.find((fallback) => fallback.name === skill)
        }
    }

    async init() {
        if (await getSetting("service.nlp.enabled") === "false") {
            this.logger.info("NLP is deactivated! Change service.nlp.enabled setting in the DB.");
            if (await getSetting("service.nlp.test.fallback") === "true") {
                this.fallbacks = this.loadFallbacks();
            }
            return;
        }
        this.retryDelay = await getSetting("service.nlp.retryDelay");

        // TODO Check socket io nlp service url is the same like in the db (if not, reconnect)

        //connect to nlp broker
        this.connect();

        // reset
        const self = this;
        self.info = null;
        if (this.timer) {
            this.cancelTimer();
        }

        //setup timer to periodically clean the info cache
        this.timer = setInterval(() => {
            self.info = null;
        }, 300 * 1000);
    }

    async connectClient(client, data) {
        if (!this.toNlpSocket) {
            await this.init();
        }
    }

    getInfo() {
        return this.info;
    }

    isConnected() {
        return this.toNlpSocket !== null && this.toNlpSocket.connected;
    }

    async connect() {
        const self = this;

        self.toNlpSocket = io_client(await getSetting("service.nlp.url"),
            {
                auth: {token: await getSetting("service.nlp.token")},
                reconnection: true,
                timeout: await getSetting("service.nlp.timeout"), //timeout between connection attempts
            }
        );

        // Handle connection errors
        self.toNlpSocket.on("connect_error", async () => {
            if (await getSetting("service.nlp.test.fallback") === "true") {
                this.fallbacks = this.loadFallbacks();
            } else {
                setTimeout(() => {
                    if (self.toNlpSocket) self.toNlpSocket.connect();
                }, self.retryDelay);
            }
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
        self.toNlpSocket.on("skillUpdate", (data) => {
            //deep copy (otherwise info becomes undefined)
            const up = JSON.parse(JSON.stringify(data.data));
            const upSkills = up.map(s => s.name);

            if (self.info !== null) {
                self.info = self.info.filter(e => !upSkills.includes(e.name));
                self.info = self.info.concat(up.filter(s => s.nodes > 0));
            } else {
                self.info = up;
            }

            // TODO Configs cachen
            self.toNlpSocket.emit("skillGetConfig", {});

            self.sendAll({
                service: "NLPService", type: "skillUpdate", data: self.info
            })
        });

        self.toNlpSocket.onAny((msg, data) => {

            // TODO Reponse using client id and send response
            const cid = NLPService.#extractClientId(data);
            const toClientSocket = self.server.availSockets[cid]["NLPSocket"].socket;
            this.toNlpSocket.emit(msg, {clientId: cid, clientSecret: null, data: data ? data : null});

            toClientSocket.emit("nlp_" + msg, {id: data.id ? data.id : null, data: data.data});
        });
    }

    command(client, command, data) {
        if (command === "skillGetAll" && this.info !== null) {
            const toClientSocket = this.server.availSockets[cid]["NLPSocket"].socket;

            toClientSocket.emit("nlp_skillUpdate", this.info);
        }

        // TODO Configs send from cache
        if (command === "skillGetConfig") {

        }
    }

    request(client, data) {
        data["clientId"] = client.socket.id;
        this.toNlpSocket.emit("skilLRequest", data);
    }

    cancelTimer() {
        if (this.timer) {
            clearInterval(this.timer);
        }
    }

    static #extractClientId(data) {
        return data.clientId ? data.clientId : null;
    }

    close() {
        this.cancelTimer();
        if (this.toNlpSocket) {
            this.toNlpSocket.disconnect();
            this.toNlpSocket = null;
        }
    }
}