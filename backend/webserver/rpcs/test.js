const RPC = require("../RPC.js");

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
        const url = "ws://" + process.env.RPC_TEST_HOST + ":" + process.env.RPC_TEST_PORT;
        super(server, url);

    }
}