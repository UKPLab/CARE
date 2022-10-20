/* Handle tags through websocket

Loading tags and tagSets through websocket

Author: Dennis Zyska (zyska@...)
Source: --
*/
const {
    getAllByUser: getAllTagsByUser,
    getAll: getAllTags,
    add: addTag,
    update: updateTag,
    get: getTag,
    getAllBySetId: getAllTagsBySetId,
    publish: publishTag,
    remove: deleteTag
} = require("../../db/methods/tag.js");
const {
    getAllByUser: getAllTagSetsByUser, getAll: getAllTagSets,
    add: addTagset, update: updateTagset, get: getTagset, publish: publishTagset, remove: deleteTagset
} = require("../../db/methods/tag_set.js");
const {getUsername} = require("../../db/methods/user");

const logger = require("../../utils/logger.js")("sockets/tags");


exports = module.exports = function (io) {
    io.on("connection", (socket) => {

        const sendTagsetUpdate = async (tagset) => {
            tagset.dataValues['username'] = await getUsername(tagset['userId'])
            socket.emit("tagSetUpdate", tagset);
        }

        const sendTagsUpdate = async (tags) => {
            for (let tag of tags) {
                tag.dataValues['username'] = await getUsername(tag['userId'])
            }
            socket.emit("tagsUpdate", tags);
        }

        const sendTagsetsUpdate = async (tagsets) => {
            for (let tagset of tagsets) {
                tagset.dataValues['username'] = await getUsername(tagset['userId'])
            }
            socket.emit("tagSetsUpdate", tagsets);
        }

        const sendTags = async () => {
            try {
                sendTagsUpdate(await getAllTags());
            } catch (err) {
                logger.error(err, {user: socket.request.session.passport.user.id});
            }
        };

        const sendTagsByUser = async (user_id) => {
            try {
                sendTagsUpdate(await getAllTagsByUser(user_id));
            } catch (err) {
                logger.error(err, {user: socket.request.session.passport.user.id});
            }
        };

        const sendTagSet = async () => {
            try {
                sendTagsetsUpdate(await getAllTagSets());
            } catch (err) {
                logger.error(err, {user: socket.request.session.passport.user.id});
            }
        };

        const sendTagSetByUser = async (user_id) => {
            try {
                sendTagsetsUpdate(await getAllTagSetsByUser(user_id));
            } catch (err) {
                logger.error(err, {user: socket.request.session.passport.user.id});
            }
        };

        const sendTagsBySetId = async (user, id) => {
            try {
                const tags = await getAllTagsBySetId(id);

                if (user.sysrole === "admin") {
                    sendTagsUpdate(tags);
                } else {
                    sendTagsUpdate(tags.filter(t => t.public || t.userId === user.id))
                }
            } catch (err) {
                logger.error(err, {user: socket.request.session.passport.user.id});
            }
        }

        const sendTagSetById = async (user, id) => {
            try {
                const tagset = await getTagset(id);
                if (user.sysrole === "admin" || user.id === tagset.userId || tagset.public) {
                    sendTagsetUpdate(tagset);
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


        socket.on("getTagById", async (id) => {
            try {
                const tag = await getTag(id);
                const user = socket.request.session.passport.user;
                if (user.sysrole === "admin" || user.id === tag.userId || tag.public) {
                    sendTagsUpdate([tag]);
                } else {
                    socket.emit("toast", {
                        message: "You have no permission to see this tag",
                        title: "Permission Error",
                        variant: 'danger'
                    });
                }
            } catch (err) {
                logger.error(err, {user: socket.request.session.passport.user.id});
            }
        });

        socket.on("getTagBySetId", async (id) => {
            const user = socket.request.session.passport.user;
            await sendTagBySetId(user, id);


        });

        socket.on("getTagSetById", async (id) => {
            const user = socket.request.session.passport.user;
            await sendTagSetById(user, id);
            await sendTagsBySetId(user, id);
        });

        socket.on("getTagSets", async () => {
            try {
                const user = socket.request.session.passport.user;
                if (user.sysrole === "admin") {
                    sendTagSet();
                } else {
                    sendTagSetByUser(user.id);
                }
            } catch (err) {
                logger.error(err, {user: socket.request.session.passport.user.id});
            }
        });

        socket.on("getTags", async () => {
            try {
                const user = socket.request.session.passport.user;
                if (user.sysrole === "admin") {
                    sendTags();
                } else {
                    sendTagsByUser(user.id);
                }
            } catch (err) {
                logger.error(err, {user: socket.request.session.passport.user.id});
            }
        });

        socket.on("saveTagset", async (data) => {
            let tagsetObj;
            if (data.tagset.id === 0) {
                data.tagset.userId = socket.request.session.passport.user.id;
                tagsetObj = await addTagset(data.tagset);
            } else {
                // security check
                if (socket.request.session.passport.user.sysrole !== "admin") {
                    const prevTagset = await getTagset(data.tagset.id);
                    if (prevTagset.userId !== socket.request.session.passport.user.id) {
                        socket.emit("toast", {
                            message: "You have no permission to change this tagset",
                            title: "Tagset Not Saved",
                            variant: 'danger'
                        });
                        return;
                    }
                }

                tagsetObj = await updateTagset(data.tagset);
                tagsetObj = tagsetObj[1];
            }

            const tagObjs = await Promise.all(data.tags.map(async (t) => {
                t.setId = tagsetObj.id;
                if (t.id === 0) {
                    t.userId = socket.request.session.passport.user.id;
                    return await addTag(t);
                } else {
                    // security check
                    if (socket.request.session.passport.user.sysrole !== "admin") {
                        const prevTag =  await getTag(t.id);
                        if (prevTag.userId !== socket.request.session.passport.user.id) {
                            return null;
                        }
                    }
                    return await updateTag(t);
                }
            }));


            if (tagObjs.includes(null)) {
                socket.emit("tagSetSaved", {success: false, message: "You have no permission to change this tag"});
                return;
            }


            sendTagsetUpdate(tagsetObj);
            sendTagsUpdate(await Promise.all(tagObjs));
            socket.emit("tagSetSaved", {success: true});
        });

        socket.on("publishTagset", async (tagsetId) => {
            // security check
            if (socket.request.session.passport.user.sysrole !== "admin") {
                const prevTagset = await getTagset(tagsetId.id);
                if (prevTagset.userId !== socket.request.session.passport.user.id) {
                    logger.error("No permission to publish tagset: " + tagsetId, {user: socket.request.session.passport.user.id});
                    socket.emit("tagSetPublished", {success: false, message: "No permission to publish tagset"});
                    return;
                }
            }

            const newTagset = await publishTagset(tagsetId.id);
            const tags = await getAllTagsBySetId(tagsetId.id);
            const newTags = await Promise.all(tags.map(async t => await publishTag(t.id)));

            await sendTagsetUpdate(newTagset[1]);
            await sendTagsUpdate(newTags.map(t => t[1]));
            socket.emit("tagSetPublished", {success: true});

        });


        socket.on("deleteTagset", async (tagsetId) => {
            // security check
            if (socket.request.session.passport.user.sysrole !== "admin") {
                const prevTagset = await getTagset(tagsetId.id);
                if (prevTagset.userId !== socket.request.session.passport.user.id) {
                    logger.error("No permission to delete tagset: " + tagsetId, {user: socket.request.session.passport.user.id});
                    socket.emit("tagSetDeleted", {success: false, message: "No permission to delete tagset"});
                    return;
                }
            }

            const newTagset = await deleteTagset(tagsetId.id);
            const tags = await getAllTagsBySetId(newTagset[1].id);
            const newTags = await Promise.all(tags.map(async t => await deleteTag(t.id)));

            sendTagsetUpdate(newTagset[1]);
            sendTagsUpdate(newTags.map(t => t[1]));
            socket.emit("tagSetDeleted", {success: true});

        });
    });
}