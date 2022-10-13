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
    publish: publishTag
} = require("../../db/methods/tag.js");
const {
    getAllByUser: getAllTagSetsByUser, getAll: getAllTagSets,
    add: addTagset, update: updateTagset, get: getTagset, publish: publishTagset
} = require("../../db/methods/tag_set.js");

const logger = require("../../utils/logger.js")("sockets/tags");


exports = module.exports = function (io) {
    io.on("connection", (socket) => {

        const sendTags = async () => {
            try {
                socket.emit("tags", await getAllTags());
            } catch (err) {
                logger.error(err, {user: socket.request.session.passport.user.id});
            }
        };

        const sendTagsByUser = async (user_id) => {
            try {
                socket.emit("tags", await getAllTagsByUser(user_id));
            } catch (err) {
                logger.error(err, {user: socket.request.session.passport.user.id});
            }
        };

        const sendTagSet = async () => {
            try {
                socket.emit("tagSets", await getAllTagSets());
            } catch (err) {
                logger.error(err, {user: socket.request.session.passport.user.id});
            }
        };

        const sendTagSetByUser = async (user_id) => {
            try {
                socket.emit("tagSets", await getAllTagSetsByUser(user_id));
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

        const sendTagsetUpdate = (tagset) => {
            socket.emit("tagSetUpdate", tagset);
        }

        const sendTagsUpdate = (tags) => {
            socket.emit("tagsUpdate", tags);
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

        socket.on("getTagsSetById", async (id) => {
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
                    const prevTagset = getTagset(data.tagset.id);
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
            }

            const tagObjs = data.tags.map((t) => {
                if (t.id === 0) {
                    t.userId = socket.request.session.passport.user.id;
                    return addTag(t);
                } else {
                    // security check
                    if (socket.request.session.passport.user.sysrole !== "admin") {
                        const prevTag = getTag(t.id);
                        if (prevTag.userId !== socket.request.session.passport.user.id) {
                            socket.emit("toast", {
                                message: "You have no permission to change this tag",
                                title: "Tag Not Saved",
                                variant: 'danger'
                            });
                            return null;
                        }
                    }
                    return updateTag(t);
                }
            });

            sendTagsetUpdate(tagsetObj);
            sendTagsUpdate(tagObjs);
        });

        socket.on("publishTagset", async (tagsetId) => {
            // security check
            if (socket.request.session.passport.user.sysrole !== "admin") {
                const prevTagset = getTagset(tagsetId);
                if (prevTagset.userId !==  socket.request.session.passport.user.id) {
                    socket.emit("toast", {
                        message: "You have no permission to publish this tagset",
                        title: "Permission Error",
                        variant: 'danger'
                    });
                    return;
                }
            }

            const newTagset = await publishTagset(tagsetId);
            const tags = await getAllTagsBySetId(newTagset.setId);
            const newTags = await Promise.all(tags.map(async t => await publishTag(t)));

            sendTagsetUpdate(newTagset);
            sendTagsUpdate(newTags);
        });
    });
}