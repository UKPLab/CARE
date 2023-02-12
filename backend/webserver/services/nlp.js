const {io: io_client} = require("socket.io-client");
const Service = require("../Service.js");
const fs = require("fs");
const path = require("path");
const yaml = require('js-yaml')


/**
 * Hold connection and data for external NLP service
 *
 * @class
 * @author Dennis Zyska, Nils Dycke
 * @classdesc A service that connects to an external NLP service via socket.io.
 * @extends Service
 */
module.exports = class NLPService extends Service {
    constructor(server) {
        super(server);

        this.retryDelay = 10000; //default delay between connection attempts

        this.skills = null;
        this.configs = null;
        this.timer = null;

        this.nlpSocket = null;
    }

    /**
     * Overwrite the init method to connect to the NLP service
     */
    async init() {
        if (await this.server.db.models['setting'].get("service.nlp.enabled") === "false") {
            this.logger.info("NLP is deactivated! Change service.nlp.enabled setting in the DB.");
            if (await this.server.db.models['setting'].get("service.nlp.test.fallback") === "true") {
                await this.loadFallbacks();
            }
            return;
        }

        // load settings from db
        this.retryDelay = await this.server.db.models['setting'].get("service.nlp.retryDelay");
        this.url = await this.server.db.models['setting'].get("service.nlp.url");
        this.token = await this.server.db.models['setting'].get("service.nlp.token");
        this.timeout = await this.server.db.models['setting'].get("service.nlp.timeout");
        this.fallback = await this.server.db.models['setting'].get("service.nlp.test.fallback");


        // reset
        await this.reset();

        // connect to nlp broker
        this.nlpSocket = await this.connect();

        //setup timer to periodically clean the info cache
        const self = this;
        this.timer = setInterval(() => {
            self.info = null;
        }, 300 * 1000);
    }

    /**
     * Overwrite the destroy method to disconnect from the NLP service
     */
    async reset() {
        if (this.timer) {
            clearInterval(this.timer);
        }
        if (this.nlpSocket) {
            this.nlpSocket.disconnect();
            this.nlpSocket = null;
        }
        this.skills = null;
        this.configs = null;

    }

    /**
     * Connect to the NLP service
     */
    async connect() {
        const self = this;

        const nlpSocket = io_client(this.url,
            {
                auth: {token: this.token},
                reconnection: true,
                timeout: this.timeout,
            }
        );

        // Handle connection errors
        nlpSocket.on("connect_error", async () => {
            if (this.fallback === "true") {
                await self.loadFallbacks();
            }
            setTimeout(() => {
                if (nlpSocket) {
                    nlpSocket.connect();
                }
            }, self.retryDelay);

        });

        // Handle reconnection attempts
        nlpSocket.on("reconnection_attempt", () => {
            self.logger.error("Broker Reconnection attempt...");
        });

        // establishing a connection
        nlpSocket.on("connect", function () {
            self.logger.info(`Connection to NLP server established: ${self.nlpSocket.connected}`);

            // if connection established, get information about the NLP Service
            this.skills = null;
            self.nlpSocket.emit("skillGetAll");
        });

        // deal with broken connection
        nlpSocket.on("disconnect", function () {
            self.logger.error(`Connection to NLP server disrupted: ${!self.nlpSocket.connected}`);
        });

        nlpSocket.on("skillConfig", (data) => {
            // deep copy (otherwise we may get an undefined object)
            const config = JSON.parse(JSON.stringify(data));
            self.#updateConfigCache(config);
        });

        nlpSocket.on("skillUpdate", (data) => {
            // update cache with deep copy of data
            const skills = JSON.parse(JSON.stringify(data));
            this.#updateSkillCache(skills);

            // delete configs of removed skills and request configs for changed services (that were not deleted)
            skills.filter(s => s.nodes === 0 && s.name in self.configs).forEach(s => delete self.configs[s.name]);
            skills.filter(s => s.nodes > 0).forEach(s => nlpSocket.emit("skillGetConfig", {name: s.name}));

            self.sendAll("skillUpdate", self.skills);
        });

        nlpSocket.on("skillResults", (data) => {
            const client = self.#getClient(data.clientId)
            delete data.clientId;
            if (client) {
                self.send(client, "skillResults", data);
            }
        });

        nlpSocket.connect();
        return nlpSocket;
    }

    /**
     * Send client the current skill list
     * @param client
     * @param data
     */
    async connectClient(client, data) {
        this.send(client, "skillUpdate", this.skills !== null ? this.skills : []);
    }

    /**
     * Update the skill cache
     * @param updatedSkills
     */
    #updateSkillCache(updatedSkills) {
        if (this.skills !== null) {
            const upSkills = updatedSkills.map(s => s.name);

            this.skills = this.skills.filter(e => !upSkills.includes(e.name));
            this.skills = this.skills.concat(updatedSkills.filter(s => s.nodes > 0));
        } else {
            this.skills = updatedSkills;
        }
    }

    /**
     * Update the config cache
     * @param updatedConfig
     */
    #updateConfigCache(updatedConfig) {
        if (this.configs === null) {
            this.configs = {};
        }
        this.configs[updatedConfig.name] = updatedConfig;
    }

    /**
     * Get the client socket from id
     * @param {string} clientId
     * @return {*}
     */
    #getClient(clientId) {
        if (clientId in this.server.availSockets) {
            return this.server.availSockets[clientId]["ServiceSocket"];
        } else {
            this.logger.error(`Client ${clientId} not found!`);
        }
    }

    /**
     * Overwrite the destroy method to disconnect from the NLP service
     */
    async close() {
        await this.reset();
    }

    /**
     * Overwrite method to handle incoming commands
     * @param client
     * @param {string} command
     * @param {object} data
     */
    async command(client, command, data) {
        if (command === "skillGetAll") {
            if (!this.skills) {
                await this.send(client, "skillUpdate", [])
            } else {
                await this.send(client, "skillUpdate", this.skills);
            }
        } else if (command === "skillGetConfig") {
            if (this.configs && data.name in this.configs) {
                await this.send(client, "skillConfig", this.configs[data.name]);
            } else {
                await this.send(client, "skillConfig", null);
            }
        }
    }

    /**
     * Overwrite method to handle incoming requests
     * @param client
     * @param data
     * @return {Promise<void>}
     */
    async request(client, data) {

        if (this.nlpSocket && this.nlpSocket.connected) {
            data["clientId"] = client.socket.id;
            this.nlpSocket.emit("skillRequest", data);
        } else if (this.skills && this.skills.includes(data.name)) {

            await this.send(client, "skillResults", {
                id: data.id,
                data: this.configs[data.name].output.example,
                fallback: true
            });
        }

    }

    /**
     * Load fallbacks for skills if service is not available
     * @return {Promise<*>}
     */
    async loadFallbacks() {
        this.skills = [];
        this.configs = {};
        await fs.readdir(path.resolve(__dirname, "../../../files/sdf"), async (err, files) => {
            await Promise.all(files.filter(file => file.endsWith(".yaml")).map(async file => {
                if (file.endsWith(".yaml")) {
                    fs.readFile(path.join(path.resolve(__dirname, "../../../files/sdf"), file), "utf8", (err, data) => {
                        if (err) {
                            this.logger.error(err)
                            return null;
                        }
                        const skill = yaml.load(data);
                        this.skills.push({name: skill.name, nodes: 1, "fallback": true});
                        this.configs[skill.name] = skill;
                    });
                }
            }));
        });
    }

}