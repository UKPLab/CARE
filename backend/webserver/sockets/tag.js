const Socket = require("../Socket.js");

/**
 * Loading tags and tagSets through websocket
 *
 * @author Dennis Zyska, Nils Dycke
 * @type {TagSocket}
 */
module.exports = class TagSocket extends Socket {

    async sendTagsUpdate(tags) {
        this.socket.emit("tagRefresh", await this.updateCreatorName(tags));
    }

    async sendTagSetsUpdate(tagSets) {
        this.socket.emit("tagSetRefresh", await this.updateCreatorName(tagSets));
    }

    async sendTags() {
        try {
            await this.sendTagsUpdate(await this.models['tag'].getAll());
        } catch (err) {
            this.logger.error(err);
        }
    }

    async sendTagsByUser() {
        try {
            const tags = await this.models['tag'].getAll();
            await this.sendTagsUpdate(tags.filter(t => t.public || t.userId === this.userId || t.userId === null));
        } catch (err) {
            this.logger.error(err);
        }
    };

    async sendTagSets() {
        try {
            await this.sendTagSetsUpdate(await this.models['tag_set'].getAll());
        } catch (err) {
            this.logger.error(err);
        }
    };

    async sendTagSetsByUser() {
        try {
            const tagSets = await this.models['tag_set'].getAll();
            await this.sendTagSetsUpdate(tagSets.filter(t => t.public || t.userId === this.userId || t.userId === null));
        } catch (err) {
            this.logger.error(err);
        }
    };

    async sendTagsBySetId(tagSetId) {
        try {
            const tags = await this.models['tag'].getAllByKey('tagSetId', tagSetId);

            if (this.isAdmin()) {
                await this.sendTagsUpdate(tags);
            } else {
                await this.sendTagsUpdate(tags.filter(t => t.public || t.userId === this.userId))
            }
        } catch (err) {
            this.logger.error(err);
        }
    }

    async sendTagSetById(tagSetId) {
        try {
            const tagSet = await this.models['tag_set'].getById(tagSetId);
            if (this.checkUserAccess(tagSet.userId) || tagSet.public) {
                await this.sendTagSetsUpdate(tagSet);
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
                const tag = await this.models['tag'].getById(data.tagId);
                if (this.checkUserAccess(tag.userId) || tag.public) {
                    await this.sendTagsUpdate(tag);
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
                data.tagSet.userId = this.userId;
                data.tagSet.public = false;
                data.tags.forEach(t => t.userId = this.userId);
                data.tags.forEach(t => t.public = false);
                tagSetObj = await this.models['tag_set'].add(data.tagSet);
            } else {
                // security check
                const prevTagSet = await this.models['tag_set'].getById(data.tagSetId);
                if (!this.checkUserAccess(prevTagSet.userId)) {
                    this.sendToast("You have no permission to edit this tagSet", "Permission Error", "danger");
                    return;
                }

                tagSetObj = await this.models['tag_set'].updateById(data.tagSetId, data.tagSet);
            }

            const tagObjs = await Promise.all(data.tags.map(async (t) => {
                t.tagSetId = tagSetObj.id;
                if (t.id === 0) {
                    t.userId = this.userId;
                    return await this.models['tag'].add(t);
                } else {
                    const prevTag = await this.models['tag'].getById(t.id);
                    if (!this.checkUserAccess(prevTag.userId)) {
                        return;
                    }
                    return await this.models['tag'].updateById(t.id, t);
                }
            }));

            if (tagObjs.includes(null)) {
                this.socket.emit("tagSetUpdated", {
                    success: false,
                    message: "You have no permission to change this tag"
                });
                return;
            }

            await this.sendTagSetsUpdate(tagSetObj);
            await this.sendTagsUpdate(await Promise.all(tagObjs));
            this.socket.emit("tagSetUpdated", {success: true});
        });

        this.socket.on("tagSetPublish", async (data) => {

            const prevTagSet = await this.models['tag_set'].getById(data.tagSetId);
            if (!this.checkUserAccess(prevTagSet.userId)) {
                this.logger.error("No permission to publish tagSet: " + data.tagSetId);
                this.socket.emit("tagSetPublished", {success: false, message: "No permission to publish tagSet"});
                return;
            }

            const newTagSet = await this.models['tag_set'].updateById(data.tagSetId, {public: true});
            const tags = await this.models['tag'].getAllByKey('tagSetId', data.tagSetId);
            const newTags = await Promise.all(tags.map(async t => await this.models['tag'].updateById(t.id, {public: true})));

            await this.sendTagSetsUpdate(newTagSet);
            await this.sendTagsUpdate(newTags);
            this.socket.emit("tagSetPublished", {success: true});

        });

        this.socket.on("tagSetDelete", async (data) => {

            const prevTagSet = this.models['tag_set'].getById(data.tagSetId);
            if (!this.checkUserAccess(prevTagSet.userId)) {
                this.logger.error("No permission to delete tagset: " + data.tagSetId);
                this.socket.emit("tagSetDeleted", {success: false, message: "No permission to delete tagset"});
                return;
            }

            const newTagSet = await this.models['tag_set'].deleteById(data.tagSetId);
            const tags = await this.models['tag'].getAllByKey('tagSetId', newTagSet[1].id);
            const newTags = await Promise.all(tags.map(async t => await this.models['tag'].deleteById(t.id)));

            await this.sendTagSetsUpdate(newTagSet[1]);
            await this.sendTagsUpdate(newTags.map(t => t[1]));
            this.socket.emit("tagSetDeleted", {success: true});

        });
    }

}
