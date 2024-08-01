const {io: io_client} = require("socket.io-client");
const RPC = require("../RPC.js");
const fs = require("fs");
const path = require("path");
const yaml = require('js-yaml')
const {v4: uuidv4} = require("uuid");


/**
 * Hold connection and data for external RPC test service
 *
 * @class
 * @author Dennis Zyska, Nils Dycke
 * @classdesc A service that connects to an external RPC service via socket.ic.
 * @extends RPC
 */
module.exports = class RPCtest extends RPC {
    constructor(server) {
        super(server);

        this.retryDelay = 10000; //default delay between connection attempts
        this.rpcSocket = null;
        this.url = "ws://" + process.env.RPC_TEST_HOST + ":" + process.env.RPC_TEST_PORT;
        this.timeout = 5000;
        this.jobs = {};
    }

    /**
     * Overwrite the init method to connect to the RPC service
     */
    async init() {
        // reset
        await this.reset();

        // connect to nlp broker
        this.rpcSocket = await this.connect();

    }

    /**
     * Overwrite the destroy method to disconnect from the RPC service
     */
    async reset() {
        if (this.rpcSocket) {
            this.rpcSocket.disconnect();
            this.rpcSocket = null;
        }
    }

    /**
     * Connect to the RPC service
     */
    async connect() {
        const self = this;

        const rpcSocket = io_client(this.url,
            {
                reconnection: true,
                timeout: this.timeout,
            }
        );

        // Handle connection errors
        rpcSocket.on("connect_error", async () => {

            setTimeout(() => {
                if (rpcSocket) {
                    rpcSocket.connect();
                }
            }, self.retryDelay);

        });

        // Handle reconnection attempts
        rpcSocket.on("reconnection_attempt", () => {
            self.logger.error("RPC Test Reconnection attempt...");
        });

        // establishing a connection
        rpcSocket.on("connect", function () {
            self.logger.info(`Connection to RPC server established: ${self.rpcSocket.connected}`);

        });

        // deal with broken connection
        rpcSocket.on("disconnect", function () {
            self.logger.error(`Connection to RPC server disrupted: ${!self.rpcSocket.connected}`);
        });

        rpcSocket.on("results", (data) => {
            console.log(data);

        });
        // TODO delete job id after period of time

        rpcSocket.connect();
        return rpcSocket;
    }

    /**
     * Overwrite the destroy method to disconnect from the RPC service
     */
    async close() {
        await this.reset();
    }

    /**
     * Overwrite method to handle incoming calls
     * @param {object} data
     */
    async call(data) {
       const jobID = uuidv4();
       data['jobID'] = jobID;
       this.jobs[jobID] = {

       };
       this.rpcSocket.emit("call", data);
    }

    // TODO for isOnline / getStatus

}