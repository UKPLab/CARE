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
        this.socket.emit("tagSetRefresh", tagSet);
    }

    async sendTagsUpdate(tags) {
        for (let tag of tags) {
            tag.dataValues['username'] = await dbGetUsername(tag['userId'])
        }
        this.socket.emit("tagRefresh", tags);
    }


    async sendTagSetsUpdate(tagSets) {
        for (let tagSet of tagSets) {
            tagSet.dataValues['username'] = await dbGetUsername(tagSet['userId'])
        }
        this.socket.emit("tagSetRefresh", tagSets);
    }

    async sendTags() {
        try {
            await this.sendTagsUpdate(await dbGetAllTags());
        } catch (err) {
            this.logger.error(err);
        }
    }


    async sendTagsByUser() {
        try {
            await this.sendTagsUpdate(await dbGetAllTagsByUser(this.user_id));
        } catch (err) {
            this.logger.error(err);
        }
    };

    async sendTagSets() {
        try {
            await this.sendTagSetsUpdate(await dbGetAllTagSets());
        } catch (err) {
            this.logger.error(err);
        }
    };

    async sendTagSetsByUser() {
        try {
            await this.sendTagSetsUpdate(await dbGetAllTagSetsByUser(this.user_id));
        } catch (err) {
            this.logger.error(err);
        }
    };

    async sendTagsBySetId(tagSetId) {
        try {
            const tags = await dbGetAllTagsBySetId(tagSetId);

            if (this.isAdmin()) {
                await this.sendTagsUpdate(tags);
            } else {
                await this.sendTagsUpdate(tags.filter(t => t.public || t.userId === this.user_id))
            }
        } catch (err) {
            this.logger.error(err);
        }
    }

    async sendTagSetById(tagSetId) {
        try {
            const tagSet = await dbGetTagSet(tagSetId);
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
        this.socket.on("tagGet", async (data) => {
            try {
                const tag = await dbGetTag(data.tagId);
                if (this.checkUserAccess(tag.userId) || tag.public) {
                    await this.sendTagsUpdate([tag]);
                } else {
                    this.sendToast("You have no permission to see this tag", "Permission Error", "danger");
                }
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("tagSetGet", async (data) => {
            await this.sendTagSetById(data.tagSetId);
            await this.sendTagsBySetId(data.tagSetId);
        });

        this.socket.on("tagSetGetAll", async () => {
            if (this.isAdmin()) {
                await this.sendTagSets();
            } else {
                await this.sendTagSetsByUser();
            }
        });

        this.socket.on("tagGetAll", async () => {
            if (this.isAdmin()) {
                await this.sendTags();
            } else {
                await this.sendTagsByUser();
            }
        });

        this.socket.on("tagSetUpdate", async (data) => {
            let tagSetObj;
            if (!data.tagSetId || data.tagSetId === 0) {
                data.tagSet.userId = this.user_id;
                tagSetObj = await dbAddTagSet(data.tagSet);
            } else {
                // security check
                const prevTagSet = await dbGetTagSet(data.tagSetId);
                if (!this.checkUserAccess(prevTagSet.userId)) {
                    this.sendToast("You have no permission to edit this tagSet", "Permission Error", "danger");
                    return;
                }

                tagSetObj = await dbUpdateTagSet(data.tagSetId, data.tagSet);
                tagSetObj = tagSetObj[1];
            }

            const tagObjs = await Promise.all(data.tags.map(async (t) => {
                t.setId = tagSetObj.id;
                if (t.id === 0) {
                    t.userId = this.user_id;
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
                this.socket.emit("tagSetUpdated", {success: false, message: "You have no permission to change this tag"});
                return;
            }

            await this.sendTagSetUpdate(tagSetObj);
            await this.sendTagsUpdate(await Promise.all(tagObjs));
            this.socket.emit("tagSetUpdated", {success: true});
        });

        this.socket.on("tagSetPublish", async (data) => {

            const prevTagSet = await dbGetTagSet(data.tagSetId);
            if (!this.checkUserAccess(prevTagSet.userId)) {
                this.logger.error("No permission to publish tagSet: " + data.tagSetId);
                this.socket.emit("tagSetPublished", {success: false, message: "No permission to publish tagSet"});
                return;
            }

            const newTagSet = await dbPublishTagSet(data.tagSetId);
            const tags = await dbGetAllTagsBySetId(data.tagSetId);
            const newTags = await Promise.all(tags.map(async t => await dbPublishTag(t.id)));

            await this.sendTagSetUpdate(newTagSet[1]);
            await this.sendTagsUpdate(newTags.map(t => t[1]));
            this.socket.emit("tagSetPublished", {success: true});

        });


        this.socket.on("tagSetDelete", async (data) => {

            const prevTagSet = await dbGetTagSet(data.tagSetId);
            if (!this.checkUserAccess(prevTagSet.userId)) {
                this.logger.error("No permission to delete tagset: " + data.tagSetId);
                this.socket.emit("tagSetDeleted", {success: false, message: "No permission to delete tagset"});
                return;
            }

            const newTagSet = await dbDeleteTagSet(data.tagSetId);
            const tags = await dbGetAllTagsBySetId(newTagSet[1].id);
            const newTags = await Promise.all(tags.map(async t => await dbDeleteTag(t.id)));

            await this.sendTagSetUpdate(newTagSet[1]);
            await this.sendTagsUpdate(newTags.map(t => t[1]));
            this.socket.emit("tagSetDeleted", {success: true});

        });
    }

}
