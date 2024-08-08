/**
 * Building application configuration
 *
 * This builds the configuration object that is used by the application.
 * It overwrites a basic configuration available in the frontend from the db.
 *
 * For changes in the DB, the application must be restarted!
 * Note: Make sure no sensitive data will be exposed in the frontend!
 *
 * @author Dennis Zyska
 */

/**
 * Register the routes for the config
 * @param {Server} server main server instance
 */
module.exports = function (server) {
    server.app.get('/config.js', async (req, res) => {
        const config = {
            "app.config.copyright": await server.db.models['setting'].get("app.config.copyright"),
            "app.register.requestName": await server.db.models['setting'].get("app.register.requestName"),
            "app.register.requestStats": await server.db.models['setting'].get("app.register.requestStats"),
            "app.register.terms": await server.db.models['setting'].get("app.register.terms"),
            "app.register.trackingAgreed.default": await server.db.models['setting'].get("app.register.trackingAgreed.default"),
            "app.register.dataShared.enabled": await server.db.models['setting'].get("app.register.dataShared.enabled"),
            "app.register.dataShared.default": await server.db.models['setting'].get("app.register.dataShared.default"),
            "app.login.guest": await server.db.models['setting'].get("app.login.guest"),
            "app.landing.showDocs": await server.db.models['setting'].get("app.landing.showDocs"),
            "app.landing.linkDocs": await server.db.models['setting'].get("app.landing.linkDocs"),
            "app.landing.showProject": await server.db.models['setting'].get("app.landing.showProject"),
            "app.landing.linkProject": await server.db.models['setting'].get("app.landing.linkProject"),
            "app.landing.showFeedback": await server.db.models['setting'].get("app.landing.showFeedback"),
            "app.landing.linkFeedback": await server.db.models['setting'].get("app.landing.linkFeedback"),
        };
        res.set('Content-Type', 'application/javascript');
        res.send(`window.config = JSON.parse(${JSON.stringify(JSON.stringify(config))})`);
    });
}