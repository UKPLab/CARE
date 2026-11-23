'use strict';

const {requireTokenRight, requireAnyTokenRight} = require('../../middleware/bearerAuth');
const {runWrite, runRead, readId, readFields, is} = require('./routeHelpers');
const {listTagSets, getVisibleTagSet, createTagSet, updateTagSet, deleteTagSet, readTag} = require('../../rest/tags');

const TAGS_VIEW = 'frontend.dashboard.tags.view';
const STUDIES_VIEW = 'frontend.dashboard.studies.view';
const ERRORS = {
    notFound: new Set(['errors.rest.tagSetNotFound']),
    forbidden: new Set(['errors.rest.tagSetNoAccess']),
};

/**
 * Read the tag list of a tag set from the body.
 *
 * @param {*} raw the tags value from the body
 * @returns {Object} {tags} (undefined when not given), or {error: true} when the shape is wrong
 */
function readTags(raw) {
    if (raw === undefined) {
        return {tags: undefined};
    }
    if (!Array.isArray(raw)) {
        return {error: true};
    }
    const tags = raw.map(readTag);
    return tags.some((tag) => tag === null) ? {error: true} : {tags};
}

/**
 * REST tag sets with their tags. Reading also works with studies.view, since studies pick a tag set.
 *
 * @param {Server} server main server instance
 */
function registerRestTagRoutes(server) {
    const models = server.db.models;
    const needRead = requireAnyTokenRight(server, [TAGS_VIEW, STUDIES_VIEW]);
    const needWrite = requireTokenRight(server, TAGS_VIEW);
    const spec = (label, extra = {}) => ({label, notFound: 'errors.rest.tagSetNotFound', errors: ERRORS, ...extra});

    server.app.get('/rest/v1/tag-sets', needRead, (req, res) => runRead(server, req, res, spec('list tag sets'),
        async () => ({tagSets: await listTagSets({userId: req.apiUserId}, {models})})));

    server.app.get('/rest/v1/tag-sets/:id', needRead, (req, res) => runRead(server, req, res, spec('get tag set'),
        async (options) => {
            const id = readId(req.params.id);
            const tagSet = id && await getVisibleTagSet({userId: req.apiUserId, id}, options);
            return tagSet ? {tagSet} : null;
        }));

    server.app.post('/rest/v1/tag-sets', needWrite, (req, res) => {
        const parsed = readFields(req.body, {name: is.text, description: is.textOrEmpty, projectId: is.idOrNull});
        const tags = readTags(req.body?.tags);
        if (parsed.error || tags.error || !parsed.fields.name) {
            return res.status(400).json({message: 'errors.rest.invalidTagSetField'});
        }
        return runWrite(server, req, res, spec('create tag set', {status: 201}), async (options) =>
            ({tagSet: await createTagSet({userId: req.apiUserId, ...parsed.fields, tags: tags.tags}, options)}));
    });

    server.app.patch('/rest/v1/tag-sets/:id', needWrite, (req, res) => {
        const id = readId(req.params.id);
        const parsed = readFields(req.body, {name: is.text, description: is.textOrEmpty, public: (value) => value === true});
        const tags = readTags(req.body?.tags);
        if (parsed.error || tags.error || (Object.keys(parsed.fields).length === 0 && !tags.tags)) {
            return res.status(400).json({message: 'errors.rest.invalidTagSetField'});
        }
        return runWrite(server, req, res, spec('update tag set'), async (options) => {
            const tagSet = id && await updateTagSet({userId: req.apiUserId, id, fields: parsed.fields, tags: tags.tags}, options);
            return tagSet ? {tagSet} : null;
        });
    });

    server.app.delete('/rest/v1/tag-sets/:id', needWrite, (req, res) => {
        const id = readId(req.params.id);
        return runWrite(server, req, res, spec('delete tag set'), async (options) =>
            (id && await deleteTagSet({userId: req.apiUserId, id}, options)) ? {success: true} : null);
    });
}

module.exports = {registerRestTagRoutes};
