const {getUsername} = require("../../../db/methods/user");
const {getDoc} = require("../../../db/methods/document");

/**
 * Add username as creator_name of an database entry with column creator
 *
 * Accept data as list of objects or single object
 * Note: returns always list of objects!
 *
 * @param data
 * @returns {Promise<Awaited<*&{creator_name: string|*|undefined}>[]>}
 */
exports.updateCreatorName = async function updateCreatorName(data) {
    if (!Array.isArray(data)) {
        data = [data];
    }

    return Promise.all(data.map(async x => {
        return {...x, creator_name: await getUsername(x.creator)};
    }));

}

/**
 *
 * Check if user has rights to read the document data
 *
 * NOTE: currently we accept sharing per link --> returns always true
 *
 * @param document_id
 * @param user_id
 * @returns boolean
 */
exports.checkDocumentAccess = async function checkDocumentAccess(document_id, user_id) {
    const doc = await getDoc(document_id);

    return doc !== null;
}