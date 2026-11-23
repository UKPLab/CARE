'use strict';

/**
 * User lookup by email or external id, and role names, for /rest/v1/users and /rest/v1/roles.
 *
 * REST-only: the dashboard keeps using its socket methods, which these functions mirror where noted
 * ("Mirrors …"). Called by the routes in routes/rest/.
 */

const {Op} = require('sequelize');

const USER_LOOKUP_LIMIT = 100;

/**
 * Role ids and names for /rest/v1/roles only. Roles are a public table in the dashboard too.
 *
 * @param {Object} options the REST options (models)
 * @returns {Promise<Array<Object>>} the roles (id, name)
 */
async function listRoles(options) {
    return options.models['user_role'].findAll({
        where: {deleted: false},
        attributes: ['id', 'name'],
        order: [['id', 'ASC']],
        raw: true,
    });
}

/**
 * User lookup for /rest/v1/users only.
 * Finds users by exact email or external id and returns id, name, and role names. There is no
 * "list everyone" path, and a user whose roles the caller may not list is left out without an error.
 *
 * @param {Object} data
 * @param {string[]} data.emails the emails to look up
 * @param {number[]} data.extIds the external ids to look up
 * @param {Function} data.canSeeRole true when the caller may list users of that role
 * @param {Object} options the REST options (models)
 * @returns {Promise<Array<Object>>} the users (id, firstName, lastName, roles, and the email or extId asked for)
 */
async function findUsers({emails, extIds, canSeeRole}, options) {
    const models = options.models;
    const matchers = [];
    if (emails.length > 0) {
        matchers.push({email: {[Op.in]: emails}});
    }
    if (extIds.length > 0) {
        matchers.push({extId: {[Op.in]: extIds}});
    }
    if (matchers.length === 0) {
        return [];
    }
    const rows = await models['user'].findAll({
        where: {deleted: false, [Op.or]: matchers},
        attributes: ['id', 'firstName', 'lastName', 'email', 'extId'],
        order: [['id', 'ASC']],
        limit: USER_LOOKUP_LIMIT,
        raw: true,
    });

    const roleNameById = Object.fromEntries(
        (await models['user_role'].findAll({attributes: ['id', 'name'], raw: true})).map((role) => [role.id, role.name])
    );
    // Roles of all found users in one query (same filter as user_role_matching.getUserRolesById).
    const matches = rows.length === 0 ? [] : await models['user_role_matching'].findAll({
        where: {userId: rows.map((row) => row.id), deleted: false},
        attributes: ['userId', 'userRoleId'],
        raw: true,
    });
    const seeAll = await canSeeRole('all');
    const roleVisible = {};
    const users = [];
    const roleIdsByUser = new Map(rows.map((row) => [row.id, []]));
    for (const match of matches) {
        roleIdsByUser.get(match.userId)?.push(match.userRoleId);
    }
    for (const row of rows) {
        const roles = roleIdsByUser.get(row.id)
            .map((roleId) => roleNameById[roleId])
            .filter(Boolean);
        let visible = seeAll;
        for (const role of roles) {
            if (visible) {
                break;
            }
            if (roleVisible[role] === undefined) {
                roleVisible[role] = await canSeeRole(role);
            }
            visible = roleVisible[role];
        }
        if (!visible) {
            continue;
        }
        // Echo only the key the caller already supplied, so a lookup by external id does not reveal an email.
        const user = {id: row.id, firstName: row.firstName, lastName: row.lastName, roles};
        if (emails.includes(row.email)) {
            user.email = row.email;
        }
        if (extIds.includes(row.extId)) {
            user.extId = row.extId;
        }
        users.push(user);
    }
    return users;
}

module.exports = {
    USER_LOOKUP_LIMIT,
    findUsers,
    listRoles,
};
