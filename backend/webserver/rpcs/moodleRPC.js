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
}