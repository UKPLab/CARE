const {getGroups, getElements} = require("../../db/methods/navigation");
const {getUserSettings, getSettings} = require("../../db/methods/settings");
const logger = require("../../utils/logger.js")("sockets/settings");


exports = module.exports = function (io) {

    io.on("connection", (socket) => {

        const send_settings = async () => {
            try {
                const settings = await getSettings();
                const userSettings = await getUserSettings(socket.request.session.passport.user.id);

                const returnSettings = Object.assign(settings, userSettings);

                socket.emit("settings", {settings: returnSettings});
            } catch (err) {
                logger.error(err, {user: socket.request.session.passport.user.id});
                return;
            }
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