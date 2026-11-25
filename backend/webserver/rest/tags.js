'use strict';

/**
 * Tag sets and their tags, for /rest/v1/tag-sets.
 *
 * REST-only: the dashboard keeps using its socket methods, which these functions mirror where noted
 * ("Mirrors …"). Called by the routes in routes/rest/.
 */

const TranslatableError = require('../../utils/TranslatableError');
const {Op} = require('sequelize');
const {TAG_COLORS} = require('tag-colors');
const {findActive} = require('../utils/restHelpers');
const {defaultProjectFor} = require('./projects');

const TAG_FIELDS = ['name', 'description', 'colorCode'];

/**
 * Load an own tag set for a change.
 *
 * @param {Object} models the database models
 * @param {number} userId the token owner's user id
 * @param {number} id the tag set id
 * @param {Object} [transaction] the Sequelize transaction
 * @returns {Promise<Object|null>} the tag set, or null when it does not exist
 * @throws {TranslatableError} errors.rest.tagSetNoAccess
 */
async function loadOwnTagSet(models, userId, id, transaction) {
    const tagSet = await models['tag_set'].getById(id, {transaction});
    if (!tagSet) {
        return null;
    }
    if (tagSet.userId !== userId) {
        throw new TranslatableError('errors.rest.tagSetNoAccess');
    }
    return tagSet;
}

/**
 * Check one tag from a request body. colorCode is one of the annotator colours (TAG_COLORS keys).
 *
 * @param {*} raw the tag from the body
 * @returns {Object|null} the tag fields, or null when the shape is wrong
 */
function readTag(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return null;
    }
    if (typeof raw.name !== 'string' || !raw.name.trim() || !Object.prototype.hasOwnProperty.call(TAG_COLORS, raw.colorCode)) {
        return null;
    }
    if (raw.description !== undefined && typeof raw.description !== 'string') {
        return null;
    }
    if (raw.id !== undefined && !Number.isInteger(raw.id)) {
        return null;
    }
    return {id: raw.id, name: raw.name.trim(), colorCode: raw.colorCode, description: raw.description ?? ''};
}

/**
 * Make the tags of a tag set match the list: entries with an id update that tag, entries without one
 * are created, tags left out are soft-deleted. Tags follow the set's public flag.
 *
 * @param {Object} models the database models
 * @param {number} userId the token owner's user id
 * @param {Object} tagSet the tag set row
 * @param {Array<Object>} tags the tags from readTag
 * @param {Object} [transaction] the Sequelize transaction
 * @returns {Promise<void>}
 * @throws {TranslatableError} errors.rest.tagNotInSet
 */
async function replaceTags(models, userId, tagSet, tags, transaction) {
    const existing = await models['tag'].getAllByKey('tagSetId', tagSet.id) || [];
    const keep = new Set();
    for (const tag of tags) {
        const values = Object.fromEntries(TAG_FIELDS.map((key) => [key, tag[key]]));
        if (tag.id !== undefined) {
            if (!existing.some((row) => row.id === tag.id)) {
                throw new TranslatableError('errors.rest.tagNotInSet', {id: tag.id});
            }
            await models['tag'].updateById(tag.id, values, {transaction});
            keep.add(tag.id);
        } else {
            await models['tag'].add({...values, tagSetId: tagSet.id, userId, public: tagSet.public === true},
                {transaction});
        }
    }
    for (const row of existing) {
        if (!keep.has(row.id)) {
            await models['tag'].deleteById(row.id, {transaction});
        }
    }
}

/**
 * Mirrors the dashboard's tag set form (appDataUpdate on tag_set and tag). Differs: owner from the
 * token. As in the dashboard, the set goes into the user's current project (their projects.default
 * setting, else the system default); there is no project choice.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {string} data.name the tag set name
 * @param {string} [data.description] the description
 * @param {Array<Object>} [data.tags] the tags
 * @param {Object} options the REST options (models, transaction)
 * @returns {Promise<Object>} the new tag set with its tags
 */
async function createTagSet({userId, name, description, tags}, options) {
    const models = options.models;
    // The tag_set model fills in the user's own default project; the system default covers users
    // without one, so the Tags page always shows the new set.
    const tagSet = await models['tag_set'].add({
        name, description: description ?? '', userId, public: false,
        projectId: await defaultProjectFor(models, userId),
    }, {transaction: options.transaction});
    await replaceTags(models, userId, tagSet, tags || [], options.transaction);
    return getTagSet(models, tagSet.id, options.transaction);
}

/**
 * Change name, description, publish (public true), or the tag list of an own tag set. Publishing
 * also publishes its tags and cannot be undone, as in the dashboard.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} data.id the tag set id
 * @param {Object} data.fields the fields to change
 * @param {Array<Object>} [data.tags] the new tag list
 * @param {Object} options the REST options (models, transaction)
 * @returns {Promise<Object|null>} the tag set with its tags, or null when it does not exist
 * @throws {TranslatableError} errors.rest.tagSetAlreadyPublic
 */
async function updateTagSet({userId, id, fields, tags}, options) {
    const models = options.models;
    const tagSet = await loadOwnTagSet(models, userId, id, options.transaction);
    if (!tagSet) {
        return null;
    }
    if (fields.public === false && tagSet.public) {
        throw new TranslatableError('errors.rest.tagSetAlreadyPublic');
    }
    if (Object.keys(fields).length > 0) {
        await models['tag_set'].updateById(tagSet.id, fields, {transaction: options.transaction});
    }
    if (Array.isArray(tags)) {
        const fresh = await models['tag_set'].getById(tagSet.id, {transaction: options.transaction});
        await replaceTags(models, userId, fresh, tags, options.transaction);
    }
    return getTagSet(models, tagSet.id, options.transaction);
}

/**
 * Soft-delete an own tag set. The model deletes its tags too.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} data.id the tag set id
 * @param {Object} options the REST options (models, transaction)
 * @returns {Promise<boolean|null>} true, or null when it does not exist
 */
async function deleteTagSet({userId, id}, options) {
    const tagSet = await loadOwnTagSet(options.models, userId, id, options.transaction);
    if (!tagSet) {
        return null;
    }
    await options.models['tag_set'].deleteById(tagSet.id, {transaction: options.transaction});
    return true;
}

/**
 * One tag set with its tags, without an access check.
 *
 * @param {Object} models the database models
 * @param {number} id the tag set id
 * @param {Object} [transaction] the Sequelize transaction
 * @returns {Promise<Object|null>} the tag set, or null when it does not exist
 */
async function getTagSet(models, id, transaction) {
    const tagSet = await models['tag_set'].getById(id, {attributes: ['id', 'name', 'description', 'public', 'userId', 'projectId'], transaction});
    if (!tagSet) {
        return null;
    }
    const tags = await models['tag'].getAllByKey('tagSetId', id, {attributes: ['id', 'name', 'description', 'colorCode'], order: [['id', 'ASC']], transaction});
    return {...tagSet, tags};
}

/**
 * One tag set with its tags, if it is the caller's own or public.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {number} data.id the tag set id
 * @param {Object} options the REST options (models)
 * @returns {Promise<Object|null>} the tag set, or null when it does not exist
 * @throws {TranslatableError} errors.rest.tagSetNoAccess
 */
async function getVisibleTagSet({userId, id}, options) {
    const tagSet = await getTagSet(options.models, id);
    if (tagSet && !tagSet.public && tagSet.userId !== userId) {
        throw new TranslatableError('errors.rest.tagSetNoAccess');
    }
    return tagSet;
}

/**
 * Tag sets the caller may use in a study, with their tags: their own and public ones.
 *
 * @param {Object} data
 * @param {number} data.userId the token owner's user id
 * @param {Object} options the REST options (models)
 * @returns {Promise<Array<Object>>} the tag sets
 */
async function listTagSets({userId}, options) {
    const models = options.models;
    const visible = {[Op.or]: [{userId}, {public: true}]};
    const tagSets = await findActive(models['tag_set'], visible, {
        attributes: ['id', 'name', 'description', 'public', 'userId', 'projectId'],
        order: [['id', 'ASC']],
    });
    const tags = tagSets.length === 0 ? [] : await findActive(models['tag'], {...visible, tagSetId: tagSets.map((tagSet) => tagSet.id)}, {
        attributes: ['id', 'name', 'description', 'colorCode', 'tagSetId'],
        order: [['id', 'ASC']],
    });
    return tagSets.map((tagSet) => ({
        ...tagSet,
        tags: tags.filter((tag) => tag.tagSetId === tagSet.id).map(({tagSetId, ...tag}) => tag),
    }));
}

module.exports = {
    createTagSet,
    deleteTagSet,
    getVisibleTagSet,
    listTagSets,
    readTag,
    updateTagSet,
};
