"use strict";

const { createInitialAdmin } = require("./setupAdmin");

/**
 * Set up a dev admin from ADMIN_EMAIL/ADMIN_PWD and mark the setup wizard
 * complete, skipping the first-time wizard. Active only when DEV_SKIP_WIZARD=true
 * and NODE_ENV !== "production". No-op if an admin already exists.
 *
 * @param {Server} server 
 * @returns {Promise<void>}
 */
async function setupDevAdmin(server) {
    if (process.env.DEV_SKIP_WIZARD !== "true") {
        return;
    }
    if (process.env.NODE_ENV === "production") {
        server.logger.warn("DEV_SKIP_WIZARD ignored: NODE_ENV=production");
        return;
    }

    try {
        const admins = await server.db.models["user"].getUsersByRole("admin");
        if (admins.length > 0) {
            return;
        }

        const email = process.env.ADMIN_EMAIL;
        const password = process.env.ADMIN_PWD;
        if (!email || !password) {
            server.logger.warn("DEV_SKIP_WIZARD set but ADMIN_EMAIL/ADMIN_PWD are missing.");
            return;
        }

        await createInitialAdmin(server, { userName: "admin", email, password });
        await server.db.models["setting"].set("app.setup.wizardCompleted", "true");

        server.logger.info(`DEV_SKIP_WIZARD: created admin <${email}> and marked wizard complete.`);
    } catch (err) {
        server.logger.error("DEV_SKIP_WIZARD failed: " + (err && err.message ? err.message : err));
    }
}

module.exports = { setupDevAdmin };
