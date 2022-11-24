const {getUsername} = require("../../../db/methods/user");

exports.updateCreatorName = async function updateCreatorName(data) {
    if (!Array.isArray(data)) {
        data = [data];
    }

    return Promise.all(data.map(async anno => {
        return {...anno, creator_name: await getUsername(anno.creator)};
    }));

}