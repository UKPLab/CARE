const {getUsername} = require("../../../db/methods/user");


exports.sendTagsetUpdate = async function sendTagsetUpdate(socket, tagset) {
    tagset.dataValues['username'] = await getUsername(tagset['userId'])
    socket.emit("tagSetUpdate", tagset);
}

exports.sendTagsUpdate = async function sendTagsUpdate(socket, tags) {
    for (let tag of tags) {
        tag.dataValues['username'] = await getUsername(tag['userId'])
    }
    socket.emit("tagsUpdate", tags);
}

exports.sendTagsetsUpdate = async function sendTagsetsUpdate(socket, tagsets) {
    for (let tagset of tagsets) {
        tagset.dataValues['username'] = await getUsername(tagset['userId'])
    }
    socket.emit("tagSetsUpdate", tagsets);
}

