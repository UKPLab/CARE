const Server = require("../../webserver/Server.js");

describe('Test RPC call', () => {

    /**
     * Test the RPC call
     */
    test('Test call', async () => {
        let server = new Server();

        // wait until RPCtest service is connected
        await server.rpcs["RPCtest"].wait();

        // check status
        expect(await server.rpcs["RPCtest"].isOnline()).toEqual(true);

        // call rpc and check response
        const response = await server.rpcs["RPCtest"].call("Hello")
        expect(response).toEqual("World!")

        server.stop();

    })

})
