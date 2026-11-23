'use strict';

const Socket = require('../Socket.js');

/**
 * Push the rows a REST transaction changed to open dashboards, the same way a socket write does.
 *
 * Uses Socket.broadcastChangesWithoutSocket, so each browser receives only the rows its user may
 * see. The token owner counts as the author, so their own open tabs get the change immediately,
 * as with their own socket writes.
 *
 * @param {Server} server main server instance
 * @param {number} userId the token owner's user id
 * @param {Object} transaction a committed transaction with .changes
 * @returns {Promise<void>}
 */
async function broadcastRestChanges(server, userId, transaction) {
    if (!server.io || !transaction || !transaction.changes || transaction.changes.length === 0) {
        return;
    }
    await Socket.broadcastChangesWithoutSocket(server, userId, transaction);
}

/**
 * A transaction whose after-commit steps run only when COMMIT really succeeded.
 *
 * Sequelize runs afterCommit hooks even when COMMIT itself fails, which would rename files, send
 * emails, and refresh dashboards for data that was never saved. Here afterCommit only queues the
 * step; commit() runs `onCommitted` and then the queued steps after COMMIT resolved, and sets
 * `restCommitted`. When a queued step throws, commit() rejects with `restCommitted` already true,
 * so the caller knows the data is saved.
 *
 * @param {Server} server main server instance
 * @param {Function} onCommitted receives the transaction, runs first after COMMIT
 * @returns {Promise<Object>} the Sequelize transaction
 */
async function openRestTransaction(server, onCommitted) {
    const transaction = await server.db.sequelize.transaction();
    const steps = [];
    transaction.afterCommit = (step) => {
        steps.push(step);
    };
    const commit = transaction.commit.bind(transaction);
    transaction.commit = async () => {
        await commit();
        transaction.restCommitted = true;
        await onCommitted(transaction);
        for (const step of steps) {
            await step(transaction);
        }
    };
    return transaction;
}

/**
 * Open a transaction for a REST write. After it commits, its changes go to open dashboards, then
 * its own after-commit steps run. A rollback (including a dry run) or a failed COMMIT broadcasts
 * nothing.
 *
 * @param {Server} server main server instance
 * @param {number} userId the token owner's user id
 * @returns {Promise<Object>} the Sequelize transaction
 */
function startRestTransaction(server, userId) {
    return openRestTransaction(server, (transaction) => broadcastRestChanges(server, userId, transaction)
        .catch((err) => server.logger.error('REST broadcast failed: ' + err)));
}

/**
 * For REST bulk writes that commit item by item: each transaction from `start()` adds its changes to
 * the batch when it commits, and `broadcast()` sends the whole batch to dashboards once at the end,
 * like the dashboard's own bulk actions (Socket.runBulkWithProgress). Rolled-back items and items
 * whose COMMIT failed add nothing.
 *
 * @param {Server} server main server instance
 * @param {number} userId the token owner's user id
 * @returns {Object} {start, broadcast}
 */
function restChangeBatch(server, userId) {
    const changes = [];
    return {
        /**
         * Open one item's transaction; its changes join the batch when it commits.
         *
         * @returns {Promise<Object>} the Sequelize transaction
         */
        start() {
            return openRestTransaction(server, async (transaction) => {
                changes.push(...(transaction.changes || []));
            });
        },

        /**
         * Send all committed changes of the batch to open dashboards. Failures are logged.
         *
         * @returns {Promise<void>}
         */
        broadcast() {
            return broadcastRestChanges(server, userId, {changes})
                .catch((err) => server.logger.error('REST broadcast failed: ' + err));
        },
    };
}

module.exports = {broadcastRestChanges, startRestTransaction, restChangeBatch};
