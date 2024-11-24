const Socket = require("../Socket.js");

/**
 * Loading tags and tagSets through websocket
 *
 * @author Dennis Zyska, Nils Dycke
 * @type {TagSocket}
 */
module.exports = class TagSocket extends Socket {


    /**
     * send a tag to the client
     * @param {number} tagId
     * @return {Promise<void>}
     */
    async sendTag(tagId) {
        const tag = await this.models['tag'].getById(tagId);
        if (this.checkUserAccess(tag.userId) || tag.public) {
            await this.sendTagsUpdate(tag);
        } else {
            this.sendToast("You have no permission to see this tag", "Permission Error", "danger");
        }
    }

    /**
     * update a tag set
     * @param {number} tagSetId
     * @param {object} tagSet
     * @param {array} tags
     * @return {Promise<void>}
     */
    async updateTagSet(tagSetId, tagSet, tags) {
        const currentTagSet = await this.models['tag_set'].getById(tagSetId);

        if (!this.checkUserAccess(currentTagSet.userId)) {
            this.sendToast("You have no permission to edit this tagSet", "Permission Error", "danger");
            return;
        }

        if (tagSet.deleted) {
            const eTags = await this.models['tag'].getAllByKey('tagSetId', currentTagSet.id);
            const newTags = await Promise.all(eTags.map(async t => await this.models['tag'].deleteById(t.id)));
            await this.sendTagsUpdate(newTags);
        }

        const tagSetObj = await this.models['tag_set'].updateById(tagSetId, tagSet);
        await this.handleTags(tagSetObj, tags);
    }

    /**
     * add a tag set
     * @param {object} tagSet
     * @param {array} tags
     * @return {Promise<void>}
     */
    async addTagSet(tagSet, tags) {
        tagSet.userId = this.userId;
        tagSet.public = false;
        tags.forEach(t => t.userId = this.userId);
        tags.forEach(t => t.public = false);
        const tagSetObj = await this.models['tag_set'].add(tagSet);
        await this.handleTags(tagSetObj, tags);
    }

    /**
     * Send all tags to the client after tagSet update
     * @param {object} tagSetObj
     * @param {array} tags the tags
     * @return {Promise<void>}
     */
    async handleTags(tagSetObj, tags) {
        const tagObjs = await Promise.all(tags.map(async (t) => {
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
            return;
        }

        await this.sendTagSetsUpdate(tagSetObj);
        await this.sendTagsUpdate(tagObjs);
    }

    /**
     * Publish a tagSet
     * @param data
     * @return {Promise<void>}
     */
    async publishTagSet(data) {
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
    }


    async sendTagsUpdate(tags) {
        this.emit("tagRefresh", tags);
    }

    async sendTagSetsUpdate(tagSets) {
        this.emit("tagSetRefresh", tagSets);
    }

    async sendTags() {
        try {
            this.emit("tagRefresh", await this.models['tag'].getAll());
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

            if (await this.isAdmin()) {
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
                await this.sendTag(data.tagId)
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("tagSetGet", async (data) => {
            try {
                await this.sendTagSetById(data.tagSetId);
                await this.sendTagsBySetId(data.tagSetId);
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("tagSetGetAll", async () => {
            try {
                if (await this.isAdmin()) {
                    await this.sendTagSets();
                } else {
                    await this.sendTagSetsByUser();
                }
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("tagGetAll", async () => {
            try {
                if (await this.isAdmin()) {
                    await this.sendTags();
                } else {
                    await this.sendTagsByUser();
                }
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("tagSetUpdate", async (data) => {
            try {
                if (data.tagSetId || data.tagSetId !== 0) {
                    await this.updateTagSet(data.tagSetId, data.tagSet, (data.tags) ? data.tags : []);
                } else {
                    await this.addTagSet(data.tagSet, data.tags);
                }
            } catch (err) {
                this.logger.error(err);
            }
        });

        this.socket.on("tagSetPublish", async (data) => {
            try {
                await this.publishTagSet(data);
            } catch (err) {
                this.socket.emit("tagSetPublished", {success: false, message: "Error publishing tagSet"});
                this.logger.error(err);
            }
        });

    }

}
