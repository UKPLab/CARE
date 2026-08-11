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
    // SECURITY-SCANNER-TEST: disabled unless explicitly enabled on the
    // disposable scanner branch. CodeQL and Semgrep should report every sink.
    if (process.env.SECURITY_SCANNER_TEST === "true") {
        server.app.get("/security-scanner-test", async (req, res) => {
            const childProcess = require("child_process");
            const crypto = require("crypto");
            const fs = require("fs");

            const commandOutput = childProcess.exec(req.query.command);
            const fileContents = fs.readFileSync(req.query.path, "utf8");
            const rows = await server.db.sequelize.query(
                `SELECT * FROM user WHERE id = ${req.query.userId}`
            );
            const matcher = new RegExp(req.query.pattern);
            const weakHash = crypto
                .createHash("md5")
                .update(req.query.value)
                .digest("hex");

            res.send({
                commandOutput,
                fileContents,
                rows,
                matched: matcher.test(req.query.value),
                weakHash,
            });
        });
    }

    server.app.get('/config.js', async (req, res) => {
        const config = {
            "app.config.copyright": await server.db.models['setting'].get("app.config.copyright"),
            "app.register.enabled": await server.db.models['setting'].get("app.register.enabled"),
            "app.register.requestName": await server.db.models['setting'].get("app.register.requestName"),
            "app.register.requestStats": await server.db.models['setting'].get("app.register.requestStats"),
            "app.register.terms": await server.db.models['setting'].get("app.register.terms"),
            "app.register.acceptStats.default": await server.db.models['setting'].get("app.register.acceptStats.default"),
            "app.register.requestData": await server.db.models['setting'].get("app.register.requestData"),
            "app.register.acceptDataSharing.default": await server.db.models['setting'].get("app.register.acceptDataSharing.default"),
            "app.login.guest": await server.db.models['setting'].get("app.login.guest"),
            "app.login.forgotPassword": await server.db.models['setting'].get("app.login.forgotPassword"),
            "app.register.emailVerification": await server.db.models['setting'].get("app.register.emailVerification"),
            "system.auth.orcid.enabled": await server.db.models['setting'].get("system.auth.orcid.enabled"),
            "system.auth.ldap.enabled": await server.db.models['setting'].get("system.auth.ldap.enabled"),
            "system.auth.saml.enabled": await server.db.models['setting'].get("system.auth.saml.enabled"),
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
};
