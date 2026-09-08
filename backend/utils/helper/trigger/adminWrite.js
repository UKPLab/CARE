"use strict";

/**
 * Blocks non-admin writes that arrive with a socket user (appDataUpdate always
 * sets context.currentUserId). TriggerSocket and the queue worker omit that
 * field, so they keep using their own checks.
 *
 * @param {import("sequelize").Sequelize} sequelize
 * @param {Object} [options]
 * @param {Object} [options.context]
 * @param {number} [options.context.currentUserId]
 * @returns {Promise<void>}
 */
async function assertTriggerAdminWrite(sequelize, options = {}) {
    const currentUserId = Number(options?.context?.currentUserId);
    if (!Number.isInteger(currentUserId) || currentUserId <= 0) {
        return;
    }

    const matching = sequelize.models.user_role_matching;
    const roleIds = await matching.getUserRolesById(currentUserId);
    if (!(await matching.isAdminInUserRoles(roleIds))) {
        throw new Error("You do not have permission to modify triggers.");
    }
}

module.exports = { assertTriggerAdminWrite };
