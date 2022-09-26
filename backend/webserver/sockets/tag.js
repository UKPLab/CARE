/* Handle tags through websocket

Loading tags and tagSets through websocket

Author: Dennis Zyska (zyska@...)
Source: --
*/
const {
    getAllByUser: getAllTagsByUser, getAll: getAllTags
} = require("../../db/methods/tag.js");
const {
    getAllByUser: getAllTagSetsByUser, getAll: getAllTagSets
} = require("../../db/methods/tag_set.js");

const logger = require("../../utils/logger.js")("sockets/tags");


exports = module.exports = function (io) {
    io.on("connection", (socket) => {

        const sendTags = async () => {
            try {
                socket.emit("tags", await getAllTags());
            } catch (err) {
                logger.error(err, {user: socket.request.session.passport.user.id});
            }
        };

        const sendTagsByUser = async (user_id) => {
            try {
                socket.emit("tags", await getAllTagsByUser(user_id));
            } catch (err) {
                logger.error(err, {user: socket.request.session.passport.user.id});
            }
        };

        const sendTagSet = async () => {
            try {
                socket.emit("tagSets", await getAllTagSets());
            } catch (err) {
                logger.error(err, {user: socket.request.session.passport.user.id});
            }
        };

        const sendTagSetByUser = async (user_id) => {
            try {
                socket.emit("tagSets", await getAllTagSetsByUser(user_id));
            } catch (err) {
                logger.error(err, {user: socket.request.session.passport.user.id});
            }
        };

        socket.on("getTagSets", async () => {
            try {
                const user = socket.request.session.passport.user;
                if (user.sysrole === "admin") {
                    sendTagSet();
                } else {
                    sendTagSetByUser(user.id);
                }
            } catch (err) {
                logger.error(err, {user: socket.request.session.passport.user.id});
            }
        });

        socket.on("getTags", async () => {
            try {
                const user = socket.request.session.passport.user;
                if (user.sysrole === "admin") {
                    sendTags();
                } else {
                    sendTagsByUser(user.id);
                }
            } catch (err) {
                logger.error(err, {user: socket.request.session.passport.user.id});
            }
        });

    });
}