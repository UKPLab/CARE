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
            "courseID": 1615,
            "assignmentName": "TANs",
            "options": 
            {
                "apiKey": "30c1c7dbb82e2379fb851eb9f86720eb",
                "url": "https://moodle.informatik.tu-darmstadt.de",
                "csvPath": "users.csv"
            }
        }

        const response = await server.rpcs["MoodleRPC"].call(testData)
        expect(response).toEqual("Changed Passwords!")
        
        //Rückgabe Objekt von Usern oder Fehlermeldung
        //Objekt vergleichen und schauen ob es richtig ist

        server.stop();
    })

})
