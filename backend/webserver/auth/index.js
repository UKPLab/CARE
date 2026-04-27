"use strict";

const passport = require("passport");
const { registerStrategies } = require("./strategies");

async function initializeAuth(server) {
    server.logger.debug("Initializing Auth Strategies...");

    // 1. Setup Passport Session Handling
    passport.serializeUser((user, done) => {
        done(null, user);
    });

    // When the session is authenticated, deserializeUser is called 
    // to retrieve the full user object from DB
    passport.deserializeUser((user, done) => {
        done(null, user);
    });

    await registerStrategies(server);
}

module.exports = {
    initializeAuth,
};
