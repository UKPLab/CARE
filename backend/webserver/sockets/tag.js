'use strict';

/**
 * Tag set and tag actions for /rest/v1 only. There is no socket class for this resource yet: the dashboard
 * reads it through the generic table socket. If one is added, it goes in this file below these functions.
 */

const {Op} = require('sequelize');
const {TAG_COLORS} = require('tag-colors');
const TranslatableError = require('../../utils/TranslatableError');

const TAG_FIELDS = ['name', 'description', 'colorCode'];

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
 * token. Without projectId the set goes into the user's default project, else the system default.
 */
async function createTagSet({userId, name, description, projectId, tags}, options) {
    const {defaultProjectFor, userCanUseProject} = require('./project');
    const models = options.models;
    // Same rule as documents and course tasks: an own or public project.
    if (projectId != null && !(await userCanUseProject(models, userId, projectId))) {
        throw new TranslatableError('errors.rest.invalidProjectId');
    }
    // Without a project the Tags page never shows the set, so fall back to the dashboard's project.
    const tagSet = await models['tag_set'].add({
        name, description: description ?? '', userId, public: false,
        projectId: projectId ?? await defaultProjectFor(models, userId),
    }, {transaction: options.transaction});
    await replaceTags(models, userId, tagSet, tags || [], options.transaction);
    return getTagSet(models, tagSet.id, options.transaction);
}

/**
 * Change name, description, publish (public true), or the tag list of an own tag set. Publishing
 * also publishes its tags and cannot be undone, as in the dashboard.
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
 */
async function deleteTagSet({userId, id}, options) {
    const tagSet = await loadOwnTagSet(options.models, userId, id, options.transaction);
    if (!tagSet) {
        return null;
    }
    await options.models['tag_set'].deleteById(tagSet.id, {transaction: options.transaction});
    return true;
}

async function getTagSet(models, id, transaction) {
    const tagSet = await models['tag_set'].findOne({
        where: {id, deleted: false},
        attributes: ['id', 'name', 'description', 'public', 'userId', 'projectId'],
        raw: true,
        transaction,
    });
    if (!tagSet) {
        return null;
    }
    const tags = await models['tag'].findAll({
        where: {tagSetId: id, deleted: false},
        attributes: ['id', 'name', 'description', 'colorCode'],
        order: [['id', 'ASC']],
        raw: true,
        transaction,
    });
    return {...tagSet, tags};
}

/**
 * One tag set with its tags, if it is the caller's own or public.
 * @returns {Promise<Object|null>}
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
 */
async function listTagSets({userId}, options) {
    const models = options.models;
    const visible = {deleted: false, [Op.or]: [{userId}, {public: true}]};
    const tagSets = await models['tag_set'].findAll({
        where: visible,
        attributes: ['id', 'name', 'description', 'public', 'userId', 'projectId'],
        order: [['id', 'ASC']],
        raw: true,
    });
    const tags = tagSets.length === 0 ? [] : await models['tag'].findAll({
        where: {...visible, tagSetId: tagSets.map((tagSet) => tagSet.id)},
        attributes: ['id', 'name', 'description', 'colorCode', 'tagSetId'],
        order: [['id', 'ASC']],
        raw: true,
    });
    return tagSets.map((tagSet) => ({
        ...tagSet,
        tags: tags.filter((tag) => tag.tagSetId === tagSet.id).map(({tagSetId, ...tag}) => tag),
    }));
}

module.exports = {listTagSets, getVisibleTagSet, createTagSet, updateTagSet, deleteTagSet, readTag};
