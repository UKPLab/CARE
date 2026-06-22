const {Model, Op} = require("sequelize");
const {v4: uuidv4} = require("uuid");

module.exports = class MetaModel extends Model {

    /**
     * Make model available for frontend
     * @type {boolean}
     */
    static autoTable = false;
    static publicTable = false;
    static accessMap = [];

    /**
     * Fields for frontend
     * @type {[]}
     */
    static fields = [];

    /**
     * Filter object by keys
     * @param {Object} obj
     * @param {Array} relevantFields
     * @return {Object}
     */
    static subselectFields(obj, relevantFields) {
        return Object.fromEntries(Object.entries(obj).filter(([k, v]) => relevantFields.includes(k)));
    }

    /**
     * Get db entry by id
     * @param {number} id
     * @param {Object} options - Sequelize query options
     * @param {boolean} includeDeleted include deleted db entries
     * @return {Promise<object|undefined>}
     */
    static async getById(id, options = {}, includeDeleted = false) {
        return await this.getByKey('id', id, options, includeDeleted);
    }

    /**
     * Get db entry by hash
     * @param {string} hash
     * @param {Object} options - Sequelize query options
     * @return {Promise<object|undefined>}
     */
    static async getByHash(hash, options = {}) {
        return await this.getByKey('hash', hash, options);
    }

    /**
     * Get db entry by key
     * @param {string} key
     * @param {string} id
     * @param {Object} options - Sequelize query options
     * @param {boolean} includeDeleted include deleted db entries
     * @return {Promise<object|undefined>}
     */
    static async getByKey(key, id, options = {}, includeDeleted = false) {
        if (key in this.getAttributes()) {
            try {
                if (includeDeleted) {
                    return await this.findOne({
                        where: {[key]: id},
                        raw: true, ...options
                    });
                } else {
                    return await this.findOne({
                        where: {[key]: id, 'deleted': false},
                        raw: true, ...options
                    })
                }
            } catch (err) {
                console.log(err);
            }
        } else {
            console.log("DB MetaModel Class " + key + " not available: " + this.constructor.name)
        }
    }

    /**
     * Get all db entries for auto table (filtered)
     * @param userId
     * @param filterList list of filter objects
     * @param attributes
     * @return {Promise<MetaModel[]|Object|undefined>}
     */
    static async getAutoTable(filterList = [], userId = null, attributes = null) {
        if (this.publicTable && filterList.length === 0 && !userId) {
            return await this.getAll();
        } else {
            let filter = {}

            for (let filterItem of filterList) {
                if (filterItem.key in this.getAttributes() && filterItem.key !== 'userId') {
                    if (filterItem.values && filterItem.values.length > 0) {
                        filter[filterItem.key] = {[Op.or]: filterItem.values};
                    } else {
                        if (filterItem.type === "not") {
                            filter[filterItem.key] = {[Op.not]: filterItem.value};
                        } else {
                            filter[filterItem.key] = filterItem.value;
                        }
                    }
                }
            }
            if (userId && 'userId' in this.getAttributes()) {
                if ("public" in this.getAttributes()) {
                    filter[Op.or] = [{userId: userId}, {public: true}];
                } else {
                    filter['userId'] = userId;
                }
            }
            let options = {where: filter, raw: true};
            if (attributes && attributes.length > 0) {
                options.attributes = [...new Set([...attributes, 'id'])];
            }

            return await this.findAll(options);
        }
    }

    /**
     * Get all db entries
     * @param {Object} options - Sequelize query options
     * @return {Promise<object|undefined>}
     */
    static async getAll(options = {}) {
        try {
            options["raw"] = true;
            if (!options["where"]) {
                options["where"] = {deleted: false};
            }

            return await this.findAll(options);

        } catch (err) {
            console.log(err);
        }
    }

    /**
     * Get all db entries by key and multiple values
     * @param {string} key column name
     * @param {Array} values array of column values
     * @param {Object} options - Sequelize query options
     * @param {boolean} includeDraft include draft
     *
     */
    static async getAllByKeyValues(key, values, options = {}, includeDraft = false) {
        if (key in this.getAttributes()) {
            try {
                if (!includeDraft && "draft" in this.getAttributes()) {
                    return await this.findAll({
                        where: {[key]: {[Op.in]: values}, deleted: false, draft: false},
                        raw: true
                    }, options);
                } else {
                    return await this.findAll({
                        where: {[key]: {[Op.in]: values}, deleted: false},
                        raw: true
                    }, options);
                }
            } catch (err) {
                console.log(err);
            }
        } else {
            console.log("DB MetaModel Class " + key + " not available: " + this.constructor.name)
        }
    }

    /**
     * Get all db entries by key
     * @param {string} key column name
     * @param {any} value column value
     * @param {Object} options - Sequelize query options
     * @param {boolean} includeDraft include draft
     */
    static async getAllByKey(key, value, options = {},  includeDraft = false) {
        if (key in this.getAttributes()) {
            try {
                if (!includeDraft && "draft" in this.getAttributes()) {
                    return await this.findAll({
                        where: {[key]: value, deleted: false, draft: false},
                        raw: true
                    }, options);
                } else {
                    return await this.findAll({
                        where: {[key]: value, deleted: false},
                        raw: true
                    }, options);
                }
            } catch (err) {
                console.log(err);
            }
        } else if (this.publicTable) {
            return await this.getAll(options);
        } else {
            console.log("DB MetaModel Class " + key + " not available: " + this.constructor.name)
        }
    }

    /**
     * Add new db entry
     * @param {Object} data - The data to be added to the database.
     * @param {Object} [options={}] - Optional Sequelize query options. See: https://sequelize.org/api/v7/interfaces/_sequelize_core.index.queryoptions
     * @return {Promise<object|undefined>}
     */
    static async add(data, options = {}) {
        try {
            const possibleFields = Object.keys(this.getAttributes()).filter(key => !['id', 'createdAt', 'updatedAt', 'deleted', 'deletedAt', 'creator_name'].includes(key));

            if ("hash" in this.getAttributes()) {
                data.hash = uuidv4();
            }

            const createdObject = await this.create(this.subselectFields(data, possibleFields), options);
            return createdObject.get({plain: true});

        } catch (err) {
            console.log("DB MetaModel Class " + this.constructor.name + " add error in creation: " + err.message);
            throw new Error(err.message);
        }
    }

    /**
     * Upsert data based on conflict fields
     * @param {Object} data - The data to insert or update
     * @param {Object} [options={}] - Additional options for the upsert operation
     * @returns {Promise<[MetaModel, boolean | null]>} - The upserted record and created flag
     */
    static async upsertData(data, options = {}) {
        try {
            const possibleFields = Object.keys(this.getAttributes()).filter(key => !['id', 'createdAt', 'updatedAt', 'deleted', 'deletedAt', 'creator_name'].includes(key));
            return await this.upsert(this.subselectFields(data, possibleFields), {
                ...options
            });
        } catch (err) {
            console.log("DB MetaModel Class " + this.constructor.name + " upsert error: " + err.message);
            throw new Error(err.message);
        }
    }

    /**
     * Delete db entry by id
     * @param {number} id
     * @param {Object} [options={}] - Optional Sequelize query options
     * @return {Promise<object|undefined>}
     */
    static async deleteById(id, options = {}) {
        return await this.updateById(id, {deleted: true}, options);
    }

    /**
     * Update db entry by id
     * @param {number} id
     * @param {Object} data new data object
     * @param {Object} [additionalOptions={}] - Optional Sequelize query options. See: https://sequelize.org/api/v7/interfaces/_sequelize_core.index.queryoptions
     * @return {Promise<*>}
     */
    static async updateById(id, data, additionalOptions = {}) {
        try {
            const possibleFields = Object.keys(this.getAttributes()).filter(key => !['id', 'createdAt', 'updatedAt', 'passwordHash', 'lastLoginAt', 'salt'].includes(key));

            if (data.deleted) {
                data.deletedAt = Date.now();
            }

            if (data.closed) {
                data.closed = Date.now();
            }

            let individualHooks = {};
            if ('hooks' in this.options) {
                if ('afterUpdate' in this.options.hooks || 'beforeUpdate' in this.options.hooks) {
                    individualHooks = {individualHooks: true};
                }
            }

            const options = Object.assign({}, {
                where: {
                    id: id
                },
                plain: true
            }, additionalOptions, individualHooks);

            const updatedObjects = await this.update(this.subselectFields(data, possibleFields), options);
            if (this.cache) this.cache.clear();
            return await this.getById(id, additionalOptions, true);
        } catch (err) {
            console.log("DB MetaModel Class " + this.constructor.name + " update error in creation: " + err.message);
            throw new Error(err.message);
        }

    }

}