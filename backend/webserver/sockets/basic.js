/* basic.js - Example web socket

Provides a websocket with a simple example interface.

Author: Dennis Zyska (zyska@ukp.informatik....)
Source: --
*/

const { io } = require("socket.io-client");

const client_socket = io("http://localhost:6001", {
    reconnectionDelayMax: 10000,
    auth: {
        token: "123"
    },
    query: {
        "my-key": "my-value"
    }
})

exports = module.exports = function(io) {
     io.on("connection", (socket) => {
        //console.log(socket);
        //send hello world message to nlp server websocket
        client_socket.emit("hello_world", {key: "value"});
    })


}