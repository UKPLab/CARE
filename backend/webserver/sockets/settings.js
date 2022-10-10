const {getGroups, getElements} = require("../../db/methods/navigation");
const {getUserSettings} = require("../../db/methods/settings");
const logger = require("../../utils/logger.js")("sockets/settings");


exports = module.exports = function (io) {

    io.on("connection", (socket) => {

        const send_settings = async () => {
            try {
                const settings = await getUserSettings(socket.request.session.passport.user.id);

                let new_settings = {};
                settings.filter(s => s.userId === null).forEach(ns => new_settings[ns.key] = ns.value);
                settings.filter(s => s.userId !== null).forEach(ns => new_settings[ns.key] = ns.value);
                socket.emit("settings", new_settings);
            } catch (err) {
                logger.error(err, {user: socket.request.session.passport.user.id});
                return;
            }

            socket.emit("update_docs", {"docs": rows, "status": "OK"});
        }

        const send_navigation = async () => {
            try {
                const elements = await getElements();
                const groups = await getGroups();
                socket.emit("navigation", {groups: groups, elements: elements})
            } catch (err) {
                logger.error(err, {user: socket.request.session.passport.user.id});
            }

        }

        socket.on("getSettings", async (data) => {

            await send_settings();
            await send_navigation();


        });
    });

}