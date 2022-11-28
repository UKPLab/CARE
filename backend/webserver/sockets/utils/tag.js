const {getUsername} = require("../../../db/methods/user");
const {getAll: getAllTags, getAllTagsByUser, getAllTagsBySetId} = require("../../../db/methods/tag");
const {getAll: getAllTagSets, getAllTagSetsByUser, getTagset} = require("../../../db/methods/tag_set");
const logger = require("../../../utils/logger.js")("utils/tag");

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

exports.sendTags = async (socket) => {
    try {
        this.sendTagsUpdate(socket, await getAllTags());
    } catch (err) {
        logger.error(err, {user: socket.request.session.passport.user.id});
    }
};

exports.sendTagsByUser = async (socket, user_id) => {
    try {
        this.sendTagsUpdate(socket, await getAllTagsByUser(user_id));
    } catch (err) {
        logger.error(err, {user: socket.request.session.passport.user.id});
    }
};

exports.sendTagSet = async (socket) => {
    try {
        this.sendTagsetsUpdate(socket, await getAllTagSets());
    } catch (err) {
        logger.error(err, {user: socket.request.session.passport.user.id});
    }
};

exports.sendTagSetByUser = async (socket, user_id) => {
    try {
        this.sendTagsetsUpdate(socket, await getAllTagSetsByUser(user_id));
    } catch (err) {
        logger.error(err, {user: socket.request.session.passport.user.id});
    }
};

exports.sendTagsBySetId = async (socket, user, id) => {
    try {
        const tags = await getAllTagsBySetId(id);

        if (user.sysrole === "admin") {
            this.sendTagsUpdate(socket, tags);
        } else {
            this.sendTagsUpdate(socket, tags.filter(t => t.public || t.userId === user.id))
        }
    } catch (err) {
        logger.error(err, {user: socket.request.session.passport.user.id});
    }
}

exports.sendTagSetById = async (socket, user, id) => {
    try {
        const tagset = await getTagset(id);
        if (user.sysrole === "admin" || user.id === tagset.userId || tagset.public) {
            this.sendTagsetUpdate(socket, tagset);
        } else {
            socket.emit("toast", {
                message: "You have no permission to see this tagset",
                title: "Permission Error",
                variant: 'danger'
            });
        }
    } catch (err) {
        logger.error(err, {user: socket.request.session.passport.user.id});
    }
}