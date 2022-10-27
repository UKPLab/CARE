/* Handling NLP Environment through websockets

Author: Dennis Zyska (zyska@ukp.informatik...), Nils Dycke (dycke@ukp.informatik....)
Source: --
*/
const logger = require("../../utils/logger.js")("sockets/nlp");

exports = module.exports = function (io, nlp) {
    io.on("connection", (socket) => {

        socket.on("connect", function () {
            if (!nlp.connected)
                nlp.connect();
        });

        // forwarding NLP server messages to frontend
        nlp.socket.onAny((msg, data) => {
            socket.emit("nlp_" + msg.replace("/", "_"), data);
            logger.info(`Message NLP SERVER -> FRONTEND: nlp_${msg} ${data}`);
        });


        // forwarding frontend messages to NLP server
        socket.onAny((msg, data) => {
            if (msg.startsWith("nlp_") && ws2NLP.connected) {
                nlp.socket.emit(msg.slice("nlp_".length).replace("_", "/"), data);
                logger.info(`Message FRONTEND -> NLP SERVER: ${msg}`);
            } else if (msg.startsWith("nlp_") && !ws2NLP.connected) {
                socket.emit("nlp_error", "Connection to NLP server disrupted.");
                logger.info(`Connection to NLP server disrupted on msg ${msg}: ${!ws2NLP.connected}`);
                if (msg.startsWith("nlp_")) {
                    nlp.socket.emit(msg, data)
                }
            }
        });

        socket.on("disconnect", (reason) => {
            if (nlp.connected) {
                nlp.disconnect();
            }
        });
    });
}