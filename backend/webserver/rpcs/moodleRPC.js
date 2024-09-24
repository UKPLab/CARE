const RPC = require("../RPC.js");
const {io: io_client} = require("socket.io-client");
const {spawn} = require("child_process");
const path = require("path");

/**
 * Hold connection and data for external RPC test service
 *
 * @class
 * @author Dennis Zyska, Nils Dycke
 * @classdesc A service that connects to an external RPC service via socket.ic.
 * @extends RPC
 */
module.exports = class MoodleRPC extends RPC {
    
    constructor(server) {
        const url = "ws://" + process.env.RPC_MOODLE_HOST + ":" + process.env.RPC_MOODLE_TEST_PORT;
        super(server, url);

    }

    async init() {
        await this.reset();

        // connect to test service
        this.socket = io_client(this.url,
            {
                reconnection: true,
                timeout: this.timeout,
            }
        );
        this.updateEvents(this.socket);
        this.logger.info("Connect to RPC server at " + this.url);
        this.socket.connect();

        this.logger.info("RPC initialized");

        
}

async updateEvents(socket) {
    const self = this;

    // Handle connection errors
    socket.on("connect_error", async () => {
        setTimeout(() => {
            if (socket) {
                socket.connect();
            }
        }, self.retryDelay);

    });

    // Handle reconnection attempts
    socket.on("reconnection_attempt", () => {
        self.logger.error("RPC Test Reconnection attempt...");
    });

    // establishing a connection
    socket.on("connect", function () {
        self.logger.info(`Connection to RPC server established: ${socket.connected}`);

    });

    // deal with broken connection
    socket.on("disconnect", function () {
        self.logger.error(`Connection to RPC server disrupted: ${!socket.connected}`);
    });

    this.socket.on("test123", async (data) => {
        try {
            await this.call(data);
        } catch (err) {
            this.logger.error("Test error: " + err);
            this.socket.emit("test", {success: false});
        }
});

}

    /**
     * This method should be overwritten to handle the call to the RPC service
     * @param data
     * @returns {Promise<*>}
     */
    async call(data) {
        this.logger.info("Calling RPC service...");

        try {
            this.logger.info(data);
            return this.emit("call", data);
            
        } catch (err) {
            throw err
        }

    }

    async getUsersFromCourse(data) {
        this.logger.info("Calling RPC service...");

        try {
            this.logger.info(data);
            return this.emit("getUsersFromCourse", data);
            
        } catch (err) {
            throw err
        }
    }

    async getUsersFromAssignment(data) {
        this.logger.info("Calling RPC service...");

        try {
            this.logger.info(data);
            return this.emit("getUsersFromAssignment", data);
            
        } catch (err) {
            throw err
        }
    }

    async getSubmissionInfosFromAssignment(data) {
        this.logger.info("Calling RPC service...");

        try {
            this.logger.info(data);
            return this.emit("getSubmissionInfosFromAssignment", data);
            
        } catch (err) {
            throw err
        }
    }

    async downloadSubmissionsFromUser(data) {
        this.logger.info("Calling RPC service...");

        try {
            this.logger.info(data);
            return this.emit("downloadSubmissionsFromUser", data);
            
        } catch (err) {
            throw err
        }
    }

    //Abstatt direkt returnen, ist return korrekt oder fehlerhaft und wenn ja, Error throwen
    //Testen, ob aus dem Docker Container ein Error kommt oder richtige Ausgabe


}
