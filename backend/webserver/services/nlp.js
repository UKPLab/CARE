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
        super(server, {
            cmdTypes: [
                "skillGetAll",
                "skillGetConfig"
            ],
            resTypes: [
                "skillUpdate",
                "skillConfig",
                "skillResults"
            ]
        });

        this.retryDelay = 10000; //default delay between connection attempts

        this.skills = [];
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
        this.skills = [];
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
            this.skills = [];
            self.nlpSocket.emit("skillGetAll");
        });

        // deal with broken connection
        nlpSocket.on("disconnect", function () {
            self.logger.error(`Connection to NLP server disrupted: ${!self.nlpSocket.connected}`);
        });

        // receives a list of objects, where each indicates a skill name and the number of nodes that provide it
        // we store this information in the this.skills attribute to keep track of available skills.
        nlpSocket.on("skillUpdate", (data) => {
            // update cache with deep copy of data
            const skills = JSON.parse(JSON.stringify(data));
            self.#updateSkillCache(skills);

            // check for configs for skills without them
            self.skills.filter(s => !self.#hasConfig(s))
                       .map(s => nlpSocket.emit("skillGetConfig", {name: s.name}));

            self.sendAll("skillUpdate", self.skills);
        });

        nlpSocket.on("skillResults", (data) => {
            const client = self.getClient(data.clientId)
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
        await this.send(client, "skillUpdate", this.skills);
        await super.connectClient(client, data);
    }

    /**
     * Update the skill cache
     * @param updatedSkills
     */
    #updateSkillCache(updatedSkills) {
        const upSkills = updatedSkills.map(s => s.name);

        // discard prior entries on update
        this.skills = this.skills.filter(e => !upSkills.includes(e.name));

        // add new skills or add updated skill, as long as they have connected nodes.
        // this implicitly discards skills with no connected nodes, because they were erased in the prior step
        this.skills = this.skills.concat(updatedSkills.filter(s => s.nodes > 0));
    }

    /**
     * Returns true, if the given skill has non-trivial (name, nodes always given) config.
     *
     * @param skill
     * @returns {boolean}
     */
    #hasConfig(skill) {
        return Object.keys(skill).filter(k => !["name", "nodes"].includes(k)).length > 0;
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
            // send all skills with config
            await this.send(client, "skillUpdate", this.skills.filter(s => this.#hasConfig(s)));
        } else if (command === "skillGetConfig") {
            // check for skill with config to send
            const conf = this.skills.find(n => this.#hasConfig(n) && n.name === data.name);
            await this.send(client, "skillConfig", conf ? conf : null);
        } else {
            await super.command(client, command, data);
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
        } else if (this.skills && this.skills.find(s => this.#hasConfig(s) && s.name === data.name)) {
            await this.send(client, "skillResults", {
                id: data.id,
                data: this.skills.find(s => this.#hasConfig(s) && s.name === data.name).config.output.example,
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
        await fs.readdir(path.resolve(__dirname, "../../../files/sdf"), async (err, files) => {
            await Promise.all(files.filter(file => file.endsWith(".yaml")).map(async file => {
                if (file.endsWith(".yaml")) {
                    fs.readFile(path.join(path.resolve(__dirname, "../../../files/sdf"), file), "utf8", (err, data) => {
                        if (err) {
                            this.logger.error(err)
                            return null;
                        }
                        const skill = yaml.load(data);
                        this.skills.push({config: skill, nodes: 1, "fallback": true, name:skill.name});
                    });
                }
            }));
        });
    }

}