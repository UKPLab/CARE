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

        this.skills = null;
        this.configs = null;
        this.timer = null;

        this.toNlpSocket = null;
        this.fallbacks = [];
    }

    loadFallbacks() {
        this.logger.info("Loading skill fallbacks");
        const skills = fs.readdirSync(path.resolve(__dirname, "../../../files/sdf"))
            .filter(file => file.endsWith(".yaml")).map((file) => {
                return yaml.load(fs.readFileSync(path.join(path.resolve(__dirname, "../../../files/sdf"), file), "utf8"));
            });
        this.skills = skills.map(skill => {
            return {name: skill.name, nodes: 1, "fallback": true};
        });
        this.configs = skills.reduce(function (map, obj) {
            map[obj.name] = obj;
            return map;
        }, {});
        console.log(this.configs);
        this.logger.info("Loaded fallbacks for skills: " + this.skills.map(skill => skill.name).join(", "));
        return skills;
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
        await this.connect();

        // reset
        this.skills = null;
        this.configs = null;
        if (this.timer) {
            this.cancelTimer();
        }

        //setup timer to periodically clean the info cache
        const self = this;
        this.timer = setInterval(() => {
            self.info = null;
        }, 300 * 1000);
    }

    isConnected() {
        return this.toNlpSocket !== null && this.toNlpSocket.connected;
    }

    async connectClient(client, data) {
        if (this.toNlpSocket === null) {
            await this.init();
        }

        // send current set of skills to client
        this.send(client, "skills", this.skills !== null ? this.skills : {});

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
                    if (self.toNlpSocket) {
                        self.toNlpSocket.connect();
                    }
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
            self.toNlpSocket.emit("skillGetAll");
        });

        // deal with broken connection
        self.toNlpSocket.on("disconnect", function () {
            self.logger.info(`Connection to NLP server disrupted: ${!self.toNlpSocket.connected}`);
        });

        // forwarding NLP server messages to frontend
        self.toNlpSocket.on("skillConfig", (data) => {
            //deep copy (otherwise we may get an undefined)
            const up = JSON.parse(JSON.stringify(data));

            self.#updateConfigCache(up);
        });

        self.toNlpSocket.on("skillUpdate", (data) => {
            // update cache with deep copy of data
            const up = JSON.parse(JSON.stringify(data));
            this.#updateSkillCache(up);

            // delete configs of removed skills and request configs for changed services (that were not deleted)
            up.filter(s => s.nodes === 0 && s.name in self.configs).forEach(s => delete self.configs[s.name]);
            up.filter(s => s.nodes > 0).forEach(s => self.toNlpSocket.emit("skillGetConfig", {name: s.name}));

            self.sendAll("skillUpdate", self.skills);
        });

        self.toNlpSocket.on("taskResult", (data) => {
            self.send(self.#getClient(data.clientId), "taskResult", data);
        });

        self.toNlpSocket.connect();
    }

    #updateSkillCache(updatedSkills) {
        if (this.skills !== null) {
            const upSkills = updatedSkills.map(s => s.name);

            this.skills = this.skills.filter(e => !upSkills.includes(e.name));
            this.skills = this.skills.concat(updatedSkills.filter(s => s.nodes > 0));
        } else {
            this.skills = updatedSkills;
        }
    }

    #updateConfigCache(updatedConfig) {
        if (this.configs === null) {
            this.configs = {};
        }
        this.configs[updatedConfig.name] = updatedConfig;
    }

    #getClient(clientId) {
        return this.server.availSockets[clientId]["ServiceSocket"];
    }

    command(client, command, data) {
        console.log(command)
        console.log(data)
        console.log(this.configs);


        if (command === "skillGetAll") {
            this.send(client, "skills", this.skills !== null ? this.skills : {});
        }
        if (command === "skillGetConfig") {
            this.send(client, "configs", this.configs !== null ? this.configs : []);
        }
    }

    request(client, data) {
        data["clientId"] = client.socket.id;
        this.toNlpSocket.emit("skillRequest", data);
    }

    cancelTimer() {
        if (this.timer) {
            clearInterval(this.timer);
        }
    }

    close() {
        this.cancelTimer();
        if (this.toNlpSocket) {
            this.toNlpSocket.disconnect();
            this.toNlpSocket = null;
        }
    }
}