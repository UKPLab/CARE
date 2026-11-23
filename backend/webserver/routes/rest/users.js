'use strict';

const {tokenCan} = require('../../middleware/bearerAuth');
const {findUsers, USER_LOOKUP_LIMIT} = require('../../rest/users');

/**
 * Comma-separated or repeated query values, trimmed, without empties.
 *
 * @param {string|string[]|undefined} raw the query value
 * @returns {string[]} the unique values
 */
function readList(raw) {
    if (raw === undefined) {
        return [];
    }
    const values = Array.isArray(raw) ? raw : [raw];
    return [...new Set(values.flatMap((value) => String(value).split(',')).map((value) => value.trim()).filter(Boolean))];
}

/**
 * REST users: lookup by email or external id only. There is no route that lists all users.
 *
 * @param {Server} server main server instance
 */
function registerRestUserRoutes(server) {
    const models = server.db.models;

    server.app.get('/rest/v1/users', async (req, res) => {
        const emails = readList(req.query.email);
        const rawExtIds = readList(req.query.extId);
        if (emails.length === 0 && rawExtIds.length === 0) {
            return res.status(400).json({message: 'errors.rest.userLookupRequired'});
        }
        if (rawExtIds.some((value) => !/^\d+$/.test(value))) {
            return res.status(400).json({message: 'errors.rest.invalidUserLookup'});
        }
        if (emails.length + rawExtIds.length > USER_LOOKUP_LIMIT) {
            return res.status(400).json({message: 'errors.rest.userLookupTooMany'});
        }
        try {
            const can = tokenCan(server, req);
            const users = await findUsers({
                emails,
                extIds: rawExtIds.map(Number),
                // The token and its owner both need the right for one of the user's roles.
                canSeeRole: (roleName) => can(`backend.socket.user.getUsers.${roleName}`),
            }, {models});
            return res.status(200).json({users});
        } catch (err) {
            server.logger.error('REST user lookup failed: ' + err);
            return res.status(500).json({message: 'errors.server.unknownError'});
        }
    });
}

module.exports = {registerRestUserRoutes};
