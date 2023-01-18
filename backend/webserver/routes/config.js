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
            "app.register.requestName": await dbGetSetting("app.register.requestName"),
            "app.register.requestStats": await dbGetSetting("app.register.requestStats"),
            "app.register.terms": await dbGetSetting("app.register.terms"),
            "app.login.guest": await dbGetSetting("app.login.guest"),
            "app.landing.showDocs": await dbGetSetting("app.landing.showDocs"),
            "app.landing.linkDocs": await dbGetSetting("app.landing.linkDocs"),
            "app.landing.showProject": await dbGetSetting("app.landing.showProject"),
            "app.landing.linkProject": await dbGetSetting("app.landing.linkProject"),
            "app.landing.showFeedback": await dbGetSetting("app.landing.showFeedback"),
            "app.landing.linkFeedback": await dbGetSetting("app.landing.linkFeedback"),
        };
        res.set('Content-Type', 'application/javascript');
        res.send(`window.config = JSON.parse(${JSON.stringify(JSON.stringify(config))})`);
    });
}