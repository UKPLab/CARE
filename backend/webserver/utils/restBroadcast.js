'use strict';

const Socket = require('../Socket.js');

/**
 * Push the rows a REST transaction changed to open dashboards, the same way a socket write does.
 *
 * Uses Socket.broadcastChangesWithoutSocket, so each browser receives only the rows its user may
 * see. The token owner counts as the author, so their own open tabs get the change immediately,
 * as with their own socket writes.
 *
 * @param {Object} server the Server instance
 * @param {number} userId the token owner
 * @param {import("sequelize").Transaction} transaction a committed transaction with .changes
 * @returns {Promise<void>}
 */
async function broadcastRestChanges(server, userId, transaction) {
    if (!server.io || !transaction || !transaction.changes || transaction.changes.length === 0) {
        return;
    }
    await Socket.broadcastChangesWithoutSocket(server, userId, transaction);
}

/**
 * Open a transaction for a REST write. After it commits, its changes go to open dashboards.
 * A rollback (including a dry run) broadcasts nothing.
 *
 * @param {Object} server the Server instance
 * @param {number} userId the token owner
 * @returns {Promise<import("sequelize").Transaction>}
 */
async function startRestTransaction(server, userId) {
    const transaction = await server.db.sequelize.transaction();
    transaction.afterCommit(() => broadcastRestChanges(server, userId, transaction)
        .catch((err) => server.logger.error('REST broadcast failed: ' + err)));
    return transaction;
}

/**
 * For REST bulk writes that commit item by item: each transaction from `start()` adds its changes to
 * the batch when it commits, and `broadcast()` sends the whole batch to dashboards once at the end,
 * like the dashboard's own bulk actions (Socket.runBulkWithProgress). Rolled-back items add nothing.
 *
 * @param {Object} server the Server instance
 * @param {number} userId the token owner
 * @returns {{start: function(): Promise<import("sequelize").Transaction>, broadcast: function(): Promise<void>}}
 */
function restChangeBatch(server, userId) {
    const changes = [];
    return {
        async start() {
            const transaction = await server.db.sequelize.transaction();
            transaction.afterCommit(() => {
                changes.push(...(transaction.changes || []));
            });
            return transaction;
        },
        broadcast() {
            return broadcastRestChanges(server, userId, {changes})
                .catch((err) => server.logger.error('REST broadcast failed: ' + err));
        },
    };
}

module.exports = {broadcastRestChanges, startRestTransaction, restChangeBatch};
