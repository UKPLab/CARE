const {getUsername} = require("../../../db/methods/user");

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