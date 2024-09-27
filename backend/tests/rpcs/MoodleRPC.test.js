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
            "assignmentName": "",
            "options": 
            {
                "apiKey": "1234",
                "url": "moodle.com",
            }
        }

        const response = await server.rpcs["MoodleRPC"].test(testData)
        expect(response).toEqual("Changed Passwords!")
        
        //Rückgabe Objekt von Usern oder Fehlermeldung
        //Objekt vergleichen und schauen ob es richtig ist

        server.stop();
    })

})
