const {
    getAllByUser: dbGetAllTagsByUser,
    getAll: dbGetAllTags,
    add: dbAddTag,
    update: dbUpdateTag,
    get: dbGetTag,
    getAllBySetId: dbGetAllTagsBySetId,
    publish: dbPublishTag,
    remove: dbDeleteTag
} = require("../../db/methods/tag.js");
const {
    getAllByUser: dbGetAllTagSetsByUser,
    getAll: dbGetAllTagSets,
    add: dbAddTagSet,
    update: dbUpdateTagSet,
    get: dbGetTagSet,
    publish: dbPublishTagSet,
    remove: dbDeleteTagSet
} = require("../../db/methods/tag_set.js");
const {getUsername: dbGetUsername} = require("../../db/methods/user");

const Socket = require("../Socket.js");

/**
 * Loading tags and tagSets through websocket
 *
 * @author Dennis Zyska, Nils Dycke
 * @type {TagSocket}
 */
module.exports = class TagSocket extends Socket {

    async sendTagSetUpdate(tagSet) {
        tagSet.dataValues['username'] = await dbGetUsername(tagSet['userId'])
        this.socket.emit("tagSetUpdate", tagSet);
    }

    async sendTagsUpdate(tags) {
        for (let tag of tags) {
            tag.dataValues['username'] = await dbGetUsername(tag['userId'])
        }
        this.socket.emit("tagsUpdate", tags);
    }


    async sendTagSetsUpdate(tagSets) {
        for (let tagSet of tagSets) {
            tagSet.dataValues['username'] = await dbGetUsername(tagSet['userId'])
        }
        this.socket.emit("tagSetsUpdate", tagSets);
    }

    async sendTags() {
        try {
            await this.sendTagsUpdate(await dbGetAllTags());
        } catch (err) {
            this.logger.error(err);
        }
    }


    async sendTagsByUser(user_id) {
        try {
            await this.sendTagsUpdate(await dbGetAllTagsByUser(user_id));
        } catch (err) {
            this.logger.error(err);
        }
    };

    async sendTagSet() {
        try {
            await this.sendTagSetsUpdate(await dbGetAllTagSets());
        } catch (err) {
            this.logger.error(err);
        }
    };

    async sendTagSetByUser(user_id) {
        try {
            await this.sendTagSetsUpdate(await dbGetAllTagSetsByUser(user_id));
        } catch (err) {
            this.logger.error(err);
        }
    };

    async sendTagsBySetId(user, id) {
        try {
            const tags = await dbGetAllTagsBySetId(id);

            if (user.sysrole === "admin") {
                await this.sendTagsUpdate(tags);
            } else {
                await this.sendTagsUpdate(tags.filter(t => t.public || t.userId === user.id))
            }
        } catch (err) {
            this.logger.error(err);
        }
    }

    async sendTagSetById(user, id) {
        try {
            const tagSet = await dbGetTagSet(id);
            if (this.checkUserAccess(tagSet.userId) || tagSet.public) {
                await this.sendTagSetUpdate(tagSet);
            } else {
                this.sendToast("You have no permission to see this tagSet", "Permission Error", "danger");
            }
        } catch (err) {
            this.logger.error(err);
        }
    }


    init() {
        this.socket.on("getTagById", async (id) => {
            try {
                const tag = await dbGetTag(id);
                if (this.checkUserAccess(tag.userId) || tag.public) {
                    await this.sendTagsUpdate([tag]);
                } else {
                    this.sendToast("You have no permission to see this tag", "Permission Error", "danger");
                }
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("getTagSetById", async (id) => {
            const user = this.socket.request.session.passport.user;
            await this.sendTagSetById(user, id);
            await this.sendTagsBySetId(user, id);
        });

        this.socket.on("getTagSets", async () => {
            if (this.isAdmin()) {
                await this.sendTagSet();
            } else {
                await this.sendTagSetByUser(this.socket.request.session.passport.user);
            }
        });

        this.socket.on("getTags", async () => {
            if (this.isAdmin()) {
                await this.sendTags();
            } else {
                await this.sendTagsByUser(this.socket.request.session.passport.user);
            }
        });

        this.socket.on("saveTagset", async (data) => {
            let tagSetObj;
            if (data.tagset.id === 0) {
                data.tagset.userId = this.user_id;
                tagSetObj = await dbAddTagSet(data.tagset);
            } else {
                // security check
                const prevTagSet = await dbGetTagSet(data.tagset.id);
                if (!this.checkUserAccess(prevTagSet.userId)) {
                    this.sendToast("You have no permission to edit this tagSet", "Permission Error", "danger");
                    return;
                }

                tagSetObj = await dbUpdateTagSet(data.tagset);
                tagSetObj = tagSetObj[1];
            }

            const tagObjs = await Promise.all(data.tags.map(async (t) => {
                t.setId = tagSetObj.id;
                if (t.id === 0) {
                    t.userId = this.socket.request.session.passport.user.id;
                    return await dbAddTag(t);
                } else {
                    const prevTag = await dbGetTag(t.id);
                    if (!this.checkUserAccess(prevTag.userId)) {
                        return;
                    }
                    return await dbUpdateTag(t);
                }
            }));

            if (tagObjs.includes(null)) {
                this.socket.emit("tagSetSaved", {success: false, message: "You have no permission to change this tag"});
                return;
            }

            await this.sendTagSetUpdate(tagSetObj);
            await this.sendTagsUpdate(await Promise.all(tagObjs));
            this.socket.emit("tagSetSaved", {success: true});
        });

        this.socket.on("publishTagset", async (tagSetId) => {

            const prevTagSet = await dbGetTagSet(tagSetId.id);
            if (!this.checkUserAccess(prevTagSet.userId)) {
                this.logger.error("No permission to publish tagSet: " + tagSetId);
                this.socket.emit("tagSetPublished", {success: false, message: "No permission to publish tagSet"});
                return;
            }

            const newTagSet = await dbPublishTagSet(tagSetId.id);
            const tags = await dbGetAllTagsBySetId(tagSetId.id);
            const newTags = await Promise.all(tags.map(async t => await dbPublishTag(t.id)));

            await this.sendTagSetUpdate(newTagSet[1]);
            await this.sendTagsUpdate(newTags.map(t => t[1]));
            this.socket.emit("tagSetPublished", {success: true});

        });


        this.socket.on("deleteTagset", async (tagSetId) => {

            const prevTagSet = await dbGetTagSet(tagSetId.id);
            if (!this.checkUserAccess(prevTagSet.userId)) {
                this.logger.error("No permission to delete tagset: " + tagSetId);
                this.socket.emit("tagSetDeleted", {success: false, message: "No permission to delete tagset"});
                return;
            }

            const newTagSet = await dbDeleteTagSet(tagSetId.id);
            const tags = await dbGetAllTagsBySetId(newTagSet[1].id);
            const newTags = await Promise.all(tags.map(async t => await dbDeleteTag(t.id)));

            await this.sendTagSetUpdate(newTagSet[1]);
            await this.sendTagsUpdate(newTags.map(t => t[1]));
            this.socket.emit("tagSetDeleted", {success: true});

        });
    }

}
