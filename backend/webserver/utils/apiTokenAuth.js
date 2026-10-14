'use strict';

const crypto = require('crypto');

const PREFIX = 'care_';
const TOKEN_BYTES = 32;
const DISPLAY_PREFIX_HEX_LEN = 8;

/**
 * Random CARE API secret. Prefix is for leak scanners; bytes are not derived from user data (P23).
 * @returns {string}
 */
function generateSecret() {
    return PREFIX + crypto.randomBytes(TOKEN_BYTES).toString('hex');
}

/**
 * One-way lookup hash. High-entropy secret, so SHA-256 is enough (not password PBKDF2).
 * @param {string} secret
 * @returns {string}
 */
function hashSecret(secret) {
    return crypto.createHash('sha256').update(secret, 'utf8').digest('hex');
}

/**
 * Stable list label. Never the full secret.
 * @param {string} secret
 * @returns {string}
 */
function displayPrefixFromSecret(secret) {
    const hex = secret.slice(PREFIX.length, PREFIX.length + DISPLAY_PREFIX_HEX_LEN);
    return PREFIX + hex;
}

/**
 * @param {string|null|undefined} value
 * @returns {boolean}
 */
function isApiTokensEnabled(value) {
    return String(value) === 'true';
}

/**
 * 4-only: blocked when the user has exactly one role and that role is guest.
 * @param {Object} models
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
async function hasOnlyGuestRole(models, userId) {
    const roleIds = await models['user_role_matching'].getUserRolesById(userId);
    if (roleIds.length !== 1) {
        return false;
    }
    const guestRole = await models['user_role'].findOne({
        where: {id: roleIds[0], name: 'guest'},
        attributes: ['id'],
        raw: true,
    });
    return Boolean(guestRole);
}

/**
 * @param {Object} userRightsByRole
 * @returns {string[]}
 */
function flattenOwnerRights(userRightsByRole) {
    return [...new Set(Object.values(userRightsByRole || {}).flat())];
}

/**
 * @param {Object} models
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
async function ownerIsAdmin(models, userId) {
    const roleIds = await models['user_role_matching'].getUserRolesById(userId);
    return models['user_role_matching'].isAdminInUserRoles(roleIds);
}

/**
 * Rights the owner may attach to a token. Admin is treated as every defined user_right.
 * @param {Object} models
 * @param {number} userId
 * @returns {Promise<string[]>}
 */
async function listAttachableRights(models, userId) {
    if (await ownerIsAdmin(models, userId)) {
        const rows = await models['user_right'].findAll({
            attributes: ['name', 'deleted'],
            raw: true,
        });
        return rows.filter((row) => row.deleted !== true).map((row) => row.name);
    }
    const byRole = await models['user'].getUserRights(userId);
    return flattenOwnerRights(byRole);
}

/**
 * Token may act only if the join row exists and the owner still has that right (or is admin).
 * @param {Object} models
 * @param {Object} token
 * @param {string} right
 * @returns {Promise<boolean>}
 */
async function tokenHasRight(models, token, right) {
    const row = await models['api_token_right'].findOne({
        where: {
            apiTokenId: token.id,
            userRightName: right,
            deleted: false,
        },
        raw: true,
    });
    if (!row) {
        return false;
    }
    if (await ownerIsAdmin(models, token.userId)) {
        return true;
    }
    return models['user_role_matching'].hasAccessByUserRoles(
        await models['user_role_matching'].getUserRolesById(token.userId),
        right
    );
}

module.exports = {
    PREFIX,
    generateSecret,
    hashSecret,
    displayPrefixFromSecret,
    isApiTokensEnabled,
    hasOnlyGuestRole,
    flattenOwnerRights,
    ownerIsAdmin,
    listAttachableRights,
    tokenHasRight,
};
