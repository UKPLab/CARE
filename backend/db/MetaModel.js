const {Model, Op} = require("sequelize");
const {v4: uuidv4} = require("uuid");

module.exports = class MetaModel extends Model {

    /**
     * Make model available for frontend
     * @type {boolean}
     */
    static autoTable = false;
    static publicTable = false;

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
     * @return {Promise<object|undefined>}
     */
    static async getById(id) {
        return await this.getByKey('id', id);
    }

    /**
     * Get db entry by hash
     * @param {string} hash
     * @return {Promise<object|undefined>}
     */
    static async getByHash(hash) {
        return await this.getByKey('hash', hash);
    }

    /**
     * Get db entry by key
     * @param {string} key
     * @param {string} id
     * @return {Promise<object|undefined>}
     */
    static async getByKey(key, id) {
        if (key in this.getAttributes()) {
            try {
                return await this.findOne({
                    where: {[key]: id, 'deleted': false},
                    raw: true
                });
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
     * @param filterIds filter IDs in Database
     * @param includeDraft includes rows with column draft is true
     * @return {Promise<MetaModel[]|Object|undefined>}
     */
    static async getAutoTable(userId = null, filterIds = null, includeDraft = false) {
        if (this.publicTable && !filterIds && !userId) {
            return await this.getAll();
        } else {
            let filter = {}
            if (!filterIds) {
                filter['deleted'] = false;
            }
            if (userId && 'userId' in this.getAttributes()) {
                if ("public" in this.getAttributes()) {
                    filter[Op.or] = [{userId: userId}, {public: true}];
                } else {
                    filter['userId'] = userId;
                }
            }
            if (filterIds !== null) {
                filter['id'] = {
                    [Op.or]: filterIds
                }
            }
            if ("draft" in this.getAttributes()) {
                filter['draft'] = includeDraft;
            }
            return await this.findAll({where: filter, raw: true});
        }
    }

    /**
     * Get all db entries
     * @param {boolean} includeDeleted - also return elements with deleted flag is true
     * @param {string[]} exclude - an array of attributes to exclude from the result
     * @return {Promise<object|undefined>}
     */
    static async getAll(includeDeleted = false, exclude = []) {
        try {
            if (includeDeleted) {
                return await this.findAll({
                    raw: true,
                    attributes: { exclude }
                });
            } else {
                return await this.findAll({
                    where: {deleted: false}, 
                    raw: true,
                    attributes: { exclude }
                });
            }

        } catch (err) {
            console.log(err);
        }
    }

    /**
     * Get all db entries by key
     * @param {string} key column name
     * @param {any} value column value
     * @param {boolean} includeDraft include draft
     */
    static async getAllByKey(key, value, includeDraft = false) {
        if (key in this.getAttributes()) {
            try {
                if (!includeDraft && "draft" in this.getAttributes()) {
                    return await this.findAll({
                        where: {[key]: value, deleted: false, draft: false},
                        raw: true
                    });
                } else {
                    return await this.findAll({
                        where: {[key]: value, deleted: false},
                        raw: true
                    });
                }
            } catch (err) {
                console.log(err);
            }
        } else if (this.publicTable) {
            return await this.getAll();
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
            const possibleFields = Object.keys(this.getAttributes()).filter(key => !['id', 'createdAt', 'updateAt'].includes(key));


            if ("hash" in this.getAttributes()) {
                data.hash = uuidv4();
            }


            return (await this.create(this.subselectFields(data, possibleFields), options)).get({plain: true});
        } catch (err) {
            console.log(err);
        }
    }

    /**
     * Delete db entry by id
     * @param {number} id
     * @return {Promise<object|undefined>}
     */
    static async deleteById(id) {
        return await this.updateById(id, {deleted: true});
    }

    /**
     * Update db entry by id
     * @param {number} id
     * @param {Object} data new data object
     * @param {Object} [additionalOptions={}] - Optional Sequelize query options. See: https://sequelize.org/api/v7/interfaces/_sequelize_core.index.queryoptions
     * @return {Promise<*>}
     */
    static async updateById(id, data, additionalOptions={}) {
        const possibleFields = Object.keys(this.getAttributes()).filter(key => !['id', 'createdAt', 'updateAt', 'passwordHash', 'lastLoginAt', 'salt'].includes(key));

        if (data.deleted) {
            data.deletedAt = Date.now();
        }

        try {
            const individualHooks = (this.tableName === 'study' || 'study_session') ? { individualHooks: true } : {};

            const options = Object.assign({}, {
                where: {
                    id: id
                },
                returning: true,
                plain: true
            }, additionalOptions, individualHooks);

            const updatedObject = await this.update(this.subselectFields(data, possibleFields), options);

            if (updatedObject) {
                if (updatedObject[1]) {
                    return updatedObject[1].dataValues;
                } else {
                    return updatedObject;
                }
            }
        } catch (err) {
            console.log(err);
        }

    }

}