/* Handle tags through websocket

Loading tags through websocket

Author: Nils Dycke (dycke@ukp.informatik....)
Source: --
*/
const {
    getAll, toFrontend
} = require("../../db/methods/tag.js");

const logger = require("../../utils/logger.js")( "sockets/tag");


exports = module.exports = function (io) {
    io.on("connection", (socket) => {
        socket.on("tags_get_all", async (data) => {
            // get all
            let tags;
            try {
                tags = await getAll();
            } catch (e) {
                logger.error(e, {user: socket.request.session.passport.user.id});
                socket.emit("tags_result", {"tags": [], success: false});
                return;
            }

            // to frontend representation of tags
            const mappedTags = tags.map(x => toFrontend(x));

            // emit
            socket.emit("tagsResult", {"tags": mappedTags, success: true});
        });
    });
}