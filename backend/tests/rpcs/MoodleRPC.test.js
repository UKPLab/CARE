const { log } = require("winston");
const Server = require("../../webserver/Server.js");

describe('Test RPC call to moodle API', () => {

    /**
     * Test the RPC call
     */
    test('Test call', async () => {
        let server = new Server();

        // wait until RPCtest service is connected
        await server.rpcs["MoodleRPC"].wait();

        // check status
        expect(await server.rpcs["MoodleRPC"].isOnline()).toEqual(true);

        // call rpc and check response
        testData = {
            "courseID": "",
            "options": 
            {
                "apiKey": "1234",
                "url": "moodle.com",
            }
        }

        const response = await server.rpcs["MoodleRPC"].getUsersFromCourse(testData)
        expect(response.success).toEqual(false)
        
        //Info: The response is false because the courseID is empty. The response should be true if the courseID is not empty. 
        //To test an a successful response, the courseID should be set to a valid value and the correct apiKey and url should be used.

        server.stop();
    })

})
