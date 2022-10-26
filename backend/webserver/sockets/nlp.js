/* Handling NLP Environment through websockets

Author: Nils Dycke (dycke@ukp.informatik....)
Source: --
*/
const logger = require("../../utils/logger.js")("sockets/nlp");
const {io:io_client} = require("socket.io-client");

const ws2NLP = io_client(`http://${process.env.NLP_HOST}:${process.env.NLP_PORT}`);

exports = module.exports = function (io) {
    io.on("connection", (socket) => {
        logger.info(`Estabilishing connection to NLP server at ${process.env.NLP_HOST}:${process.env.NLP_PORT}`);
        ws2NLP.connect();
        //todo retry connecting on failure

        // forwarding NLP server messages to frontend
        ws2NLP.onAny((msg, data) => {
           socket.emit("nlp_" + msg.replace("/", "_"), data);
           logger.info(`Message NLP SERVER -> FRONTEND: nlp_${msg} ${data}`);
        });

        // establishing a connection
        ws2NLP.on("connect", function () {
           logger.info(`Connection to NLP server established: ${ws2NLP.connected}`);
        });

        // deal with broken connection
        ws2NLP.on("disconnect", function () {
           logger.info(`Connection to NLP server disrupted: ${!ws2NLP.connected}`);

           socket.emit("nlp_error", "Connection to NLP server disrupted.");

           //todo error recovery
        });

        // forwarding frontend messages to NLP server
        socket.onAny((msg, data) => {
            if(msg.startsWith("nlp_") && ws2NLP.connected){
                ws2NLP.emit(msg.slice("nlp_".length).replace("_", "/"), data);
                logger.info(`Message FRONTEND -> NLP SERVER: ${msg}`);
            } else if(msg.startsWith("nlp_") && !ws2NLP.connected){
                socket.emit("nlp_error", "Connection to NLP server disrupted.");
                logger.info(`Connection to NLP server disrupted on msg ${msg}: ${!ws2NLP.connected}`);
            if (msg.startsWith("nlp_")) {
                ws2NLP.emit(msg, data)
            }

            //todo possibly trigger recovery of connection
        });
    });

    io.on("disconnection", (socket) => {
         //todo foward disconnect to nlp client (e.g. allowing to shut down running tasks)
        if(ws2NLP.connected){
            ws2NLP.disconnect();
        }
    });
}