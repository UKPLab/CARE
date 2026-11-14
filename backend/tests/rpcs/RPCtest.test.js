const Server = require("../../webserver/Server.js");

describe('Test RPC call', () => {

    /**
     * Test the RPC healthy probe
     */
    test('Test healthy', async () => {
        let server = new Server();

        // wait until RPCtest service is connected
        await server.rpcs["RPCtest"].wait();

        // check status
        expect(await server.rpcs["RPCtest"].isOnline()).toEqual(true);

        // run healthy probe and check response
        const response = await server.rpcs["RPCtest"].healthy();
        expect(response).toEqual("World!");

        server.stop();

    })

})
