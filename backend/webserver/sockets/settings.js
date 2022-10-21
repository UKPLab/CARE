/* Handle reviews through websocket

Author: Dennis Zyska (zyska@ukp.informatik....), Nils Dycke (dycke@ukp...)
Source: --
*/
const {getGroups, getElements} = require("../../db/methods/navigation");
const {getUserSettings, getSettings, setUserSetting} = require("../../db/methods/settings");
const logger = require("../../utils/logger.js")("sockets/settings");


exports = module.exports = function (io) {

    io.on("connection", (socket) => {

        const send_settings = async () => {
            try {
                const settings = await getSettings();
                const userSettings = await getUserSettings(socket.request.session.passport.user.id);

                let returnSettings = {};
                settings.forEach(s => returnSettings[s.key] = s.value);
                userSettings.forEach(s => returnSettings[s.key] = s.value);

                socket.emit("settings", returnSettings);
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

        socket.on("setSetting", async (data) => {
            try {
                await setUserSetting(socket.request.session.passport.user.id, data.key, data.value);
                await send_settings();
            } catch (err) {
                logger.error(err, {user: socket.request.session.passport.user.id});
            }
        });

    });

}