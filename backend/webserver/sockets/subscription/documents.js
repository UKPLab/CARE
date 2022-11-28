/* Handle subscription to documents through websocket

Author: Dennis Zyska (zyska@ukp.informatik....), Nils Dycke (dycke@ukp.infor...)
Source: --
*/
const logger = require("../../../utils/logger.js")("sockets/subscription/documents");

exports = module.exports = function (io) {
    io.on("connection", (socket) => {

        socket.on("subscribe:document", (data) => {
            socket.join("doc:" + data.doc);
            logger.info("Subscribe document " + data.doc, {user: socket.request.session.passport.user.id})
        });

        socket.on("unsubscribe:document", (data) => {
            socket.leave("doc:" + data.doc);
            logger.info("Unsubscribe document " + data.doc, {user: socket.request.session.passport.user.id})
        });

    });
};
