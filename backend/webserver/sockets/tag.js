/* Handle tags through websocket

Loading tags and tagSets through websocket

Author: Dennis Zyska (zyska@...), Nils Dycke (dycke@ukp...)
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
const {
    sendTagsetUpdate, sendTagsUpdate, sendTagsetsUpdate
} = require("./utils/tag.js")
const {getUsername} = require("../../db/methods/user");

const Socket = require("../Socket.js");
const {
    sendTags,
    sendTagsByUser,
    sendTagSet,
    sendTagSetByUser,
    sendTagSetById,
    sendTagsBySetId
} = require("./utils/tag");

module.exports = class TagSocket extends Socket {

    init() {
        this.socket.on("getTagById", async (id) => {
            try {
                const tag = await getTag(id);
                if (this.checkUserAccess(tag.userId) || tag.public) {
                    await sendTagsUpdate(this.socket, [tag]);
                } else {
                    this.sendToast("You have no permission to see this tag", "Permission Error", "danger");
                }
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("getTagSetById", async (id) => {
            const user = this.socket.request.session.passport.user;
            await sendTagSetById(this.socket, user, id);
            await sendTagsBySetId(this.socket, user, id);
        });

        this.socket.on("getTagSets", async () => {
            if (this.isAdmin()) {
                await sendTagSet(this.socket);
            } else {
                await sendTagSetByUser(this.socket.request.session.passport.user);
            }
        });

        this.socket.on("getTags", async () => {
            if (this.isAdmin()) {
                await sendTags(this.socket);
            } else {
                await sendTagsByUser(this.socket.request.session.passport.user);
            }
        });

        this.socket.on("saveTagset", async (data) => {
            let tagsetObj;
            if (data.tagset.id === 0) {
                data.tagset.userId = this.user_id;
                tagsetObj = await addTagset(data.tagset);
            } else {
                // security check
                const prevTagset = await getTagset(data.tagset.id);
                if (!this.checkUserAccess(prevTagset.userId)) {
                    this.sendToast("You have no permission to edit this tagset", "Permission Error", "danger");
                    return;
                }

                tagsetObj = await updateTagset(data.tagset);
                tagsetObj = tagsetObj[1];
            }

            const tagObjs = await Promise.all(data.tags.map(async (t) => {
                t.setId = tagsetObj.id;
                if (t.id === 0) {
                    t.userId = this.socket.request.session.passport.user.id;
                    return await addTag(t);
                } else {
                    const prevTag = await getTag(t.id);
                    if (!this.checkUserAccess(prevTag.userId)) {
                        return;
                    }
                    return await updateTag(t);
                }
            }));

            if (tagObjs.includes(null)) {
                this.socket.emit("tagSetSaved", {success: false, message: "You have no permission to change this tag"});
                return;
            }

            await sendTagsetUpdate(this.socket, tagsetObj);
            await sendTagsUpdate(this.socket, await Promise.all(tagObjs));
            this.socket.emit("tagSetSaved", {success: true});
        });

        this.socket.on("publishTagset", async (tagsetId) => {

            const prevTagset = await getTagset(tagsetId.id);
            if (!this.checkUserAccess(prevTagset.userId)) {
                this.logger.error("No permission to publish tagset: " + tagsetId, {user: this.socket.request.session.passport.user.id});
                this.socket.emit("tagSetPublished", {success: false, message: "No permission to publish tagset"});
                return;
            }

            const newTagset = await publishTagset(tagsetId.id);
            const tags = await getAllTagsBySetId(tagsetId.id);
            const newTags = await Promise.all(tags.map(async t => await publishTag(t.id)));

            await sendTagsetUpdate(this.socket, newTagset[1]);
            await sendTagsUpdate(this.socket, newTags.map(t => t[1]));
            this.socket.emit("tagSetPublished", {success: true});

        });


        this.socket.on("deleteTagset", async (tagsetId) => {

            const prevTagset = await getTagset(tagsetId.id);
            if (!this.checkUserAccess(prevTagset.userId)) {
                this.logger.error("No permission to delete tagset: " + tagsetId, {user: this.socket.request.session.passport.user.id});
                this.socket.emit("tagSetDeleted", {success: false, message: "No permission to delete tagset"});
                return;
            }

            const newTagset = await deleteTagset(tagsetId.id);
            const tags = await getAllTagsBySetId(newTagset[1].id);
            const newTags = await Promise.all(tags.map(async t => await deleteTag(t.id)));

            await sendTagsetUpdate(this.socket, newTagset[1]);
            await sendTagsUpdate(this.socket, newTags.map(t => t[1]));
            this.socket.emit("tagSetDeleted", {success: true});

        });
    }

}
