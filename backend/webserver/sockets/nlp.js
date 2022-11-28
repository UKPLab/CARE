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

        socket.on("disconnect", (reason) => {
            if (nlp.connected) {
                nlp.disconnect();
            }
        });
    });
}