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
 * What the create form offers: every right the owner may attach, with its description, and one
 * preset per role. A preset is the role's rights cut down to what the owner may attach, so
 * choosing it can never widen a token. Admins see every role, other users their own roles.
 * The admin role has no rights of its own (it bypasses checks), so it is not a preset.
 * @param {Object} models
 * @param {number} userId
 * @returns {Promise<{rights: Array<{name: string, description: string}>, roles: Array<{id: number, name: string, rights: string[]}>}>}
 */
async function listTokenRightChoices(models, userId) {
    const attachable = new Set(await listAttachableRights(models, userId));
    const rightRows = await models['user_right'].findAll({
        attributes: ['name', 'description', 'deleted'],
        order: [['name', 'ASC']],
        raw: true,
    });
    const rights = rightRows
        .filter((row) => row.deleted !== true && attachable.has(row.name))
        .map((row) => ({name: row.name, description: row.description}));

    const ownRoleIds = await models['user_role_matching'].getUserRolesById(userId);
    const admin = await models['user_role_matching'].isAdminInUserRoles(ownRoleIds);
    const roleRows = await models['user_role'].findAll({attributes: ['id', 'name', 'deleted'], raw: true});
    const roles = [];
    for (const role of roleRows) {
        if (role.deleted === true || role.name === 'admin' || !(admin || ownRoleIds.includes(role.id))) {
            continue;
        }
        const matches = await models['role_right_matching'].findAll({
            where: {userRoleId: role.id, deleted: false},
            attributes: ['userRightName'],
            raw: true,
        });
        roles.push({
            id: role.id,
            name: role.name,
            rights: [...new Set(matches.map((row) => row.userRightName))].filter((name) => attachable.has(name)),
        });
    }
    return {rights, roles};
}

/**
 * What a token is and may do right now, for GET /rest/v1/me. Uses the access bearerAuth loaded for
 * this request (loadTokenAccess), so the rights listed are exactly the ones the request checks use.
 * @param {Object} models
 * @param {Object} token api_token row
 * @param {{rights: Set<string>, roleNames: string[]}} access req.apiAccess
 * @returns {Promise<{token: Object, user: Object, rights: string[]}>}
 */
async function describeToken(models, token, access) {
    const user = await models['user'].findOne({
        where: {id: token.userId},
        attributes: ['id', 'userName', 'firstName', 'lastName'],
        raw: true,
    });
    return {
        token: {
            id: token.id,
            name: token.name,
            prefix: token.prefix,
            createdAt: token.createdAt,
            lastUsedAt: token.lastUsedAt,
            expiresAt: token.expiresAt ?? null,
        },
        user: {...user, roles: access.roleNames},
        rights: [...access.rights].sort(),
    };
}

/**
 * Everything a REST request needs to know about its token, loaded once: whether the owner still
 * exists, whether they are guest-only, and which of the token's rights the owner still holds (all
 * of them for an admin owner). Same rule as hasOnlyGuestRole for guests, and the right check every
 * route uses, in five reads (three of them in parallel).
 * @param {Object} models
 * @param {Object} token api_token row
 * @returns {Promise<{guestOnly: boolean, rights: Set<string>, roleNames: string[]}|null>} null when the owner is gone or deleted
 */
async function loadTokenAccess(models, token) {
    // Independent reads in parallel: the owner row, their roles, and the rights stored on the token.
    const [owner, roleIds, stored] = await Promise.all([
        models['user'].findOne({where: {id: token.userId}, attributes: ['id', 'deleted'], raw: true}),
        models['user_role_matching'].getUserRolesById(token.userId),
        models['api_token_right'].findAll({
            where: {apiTokenId: token.id, deleted: false},
            attributes: ['userRightName'],
            raw: true,
        }),
    ]);
    if (!owner || owner.deleted) {
        return null;
    }
    const [roles, held] = roleIds.length === 0 ? [[], []] : await Promise.all([
        models['user_role'].findAll({where: {id: roleIds}, attributes: ['id', 'name'], raw: true}),
        // Same lookup as user_role_matching.hasAccessByUserRoles, for all the owner's roles at once.
        models['role_right_matching'].findAll({where: {userRoleId: roleIds}, attributes: ['userRightName'], raw: true}),
    ]);
    const guestOnly = roleIds.length === 1 && roles.some((role) => role.id === roleIds[0] && role.name === 'guest');
    const isAdmin = roles.some((role) => role.name === 'admin');
    let rights = stored.map((row) => row.userRightName);
    if (!isAdmin) {
        const heldNames = new Set(held.map((row) => row.userRightName));
        rights = rights.filter((name) => heldNames.has(name));
    }
    return {guestOnly, rights: new Set(rights), roleNames: roles.map((role) => role.name)};
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
    listTokenRightChoices,
    describeToken,
    loadTokenAccess,
};
