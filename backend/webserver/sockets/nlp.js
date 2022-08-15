const logger = require("../../utils/logger.js")("sockets/nlp");
const {Socket} = require("socket.io");

exports = module.exports = function (io) {
    io.on("connection", (socket) => {
        logger.info(`Estabilishing connection to NLP server at ${process.env.NLP_HOST}:${process.env.NLP_PORT}`);
        //let ws2NLP = new Socket(`${process.env.NLP_HOST}:${process.env.NLP_PORT}`);
        logger.info("Websocket to NLP server established");

        // forwarding frontend messages to NLP server
        /*socket.onAny((msg, data) => {
            if(msg.startsWith("nlp_")){
                ws2NLP.emit(msg, data)
            }
        });*/

        // forwarding NLP server messages to frontend
        //ws2NLP.onAny((msg, data) => socket.emit(msg, data));
    });
}