/* config.js - Building application configuration

This builds the configuration object that is used by the application.
It overwrites a basic configuration available in the frontend from the db.

For changes in the DB, the application must be restarted!
Note: Make sure no sensitive data will be exposed in the frontend!

Author: Dennis Zyska (zyska@ukp.informatik....)
Co-Author: --
Source: --
*/

const {getSetting: dbGetSetting} = require("../../db/methods/settings");
module.exports = function (app) {
    app.get('/config.js', async (req, res) => {
        const config = {
            "app.config.copyright": await dbGetSetting("app.config.copyright"),
        }
        res.set('Content-Type', 'application/javascript');
        res.send(`window.config = ${JSON.stringify(config)}`);
    });
}