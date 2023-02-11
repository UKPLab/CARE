const {Model, Op} = require("sequelize");
const {isInternalDatabaseError, InternalDatabaseError, subselectFieldsForDB} = require("./utils");
const {v4: uuidv4} = require("uuid");

module.exports = class MetaModel extends Model {

    static async getById(id, deleted = false) {
        return await this.getByKey('id', id, deleted);
    }

    static async getByHash(hash, deleted = false) {
        return await this.getByKey('hash', hash, deleted);
    }

    static async getByKey(key, id, deleted = false) {
        if (key in this.getAttributes()) {
            try {
                return await this.findOne({
                    where: {[key]: id, 'deleted': deleted},
                    raw: true
                });
            } catch (err) {
                if (isInternalDatabaseError(err)) {
                    throw InternalDatabaseError(err);
                } else {
                    throw err;
                }
            }
        } else {
            throw InternalDatabaseError("DB MetaModel Class " + key + " not available: " + this.constructor.name)
        }
    }

    static async getAll() {
        try {
            return await this.findAll({where: {deleted: false}, raw: true});
        } catch (err) {
            if (isInternalDatabaseError(err)) {
                throw InternalDatabaseError(err);
            }
        }
    }

    static async deleteById(id) {
        try {
            return await this.update({'deleted': true, 'deletedAt': Date.now()}, {
                    where: {
                        id: id
                    },
                    returning: true,
                    plain: true
                }
            );
        } catch (err) {
            if (isInternalDatabaseError(err)) {
                throw InternalDatabaseError(err);
            } else {
                throw err;
            }
        }
    }

    static async getAllByUserId(user_id, public_check = false, deleted = false) {

        if ("userId" in this.getAttributes()) {
            try {
                if (public_check && "public" in this.getAttributes()) {
                    return await this.findAll({
                        where: {[Op.or]: [{userId: user_id}, {public: true}], deleted: deleted},
                        raw: true
                    });
                } else {
                    return await this.findAll({
                        where: {userId: user_id, deleted: deleted},
                        raw: true
                    });
                }


            } catch (err) {
                if (isInternalDatabaseError(err)) {
                    throw InternalDatabaseError(err);
                }
            }
        } else {
            throw InternalDatabaseError("DB MetaModel Class getAllByUserId not available: " + this.constructor.name)
        }
    }


    static async getAllByKey(key, id, deleted = false, includeDraft = false) {
        if (key in this.getAttributes()) {
            try {
                if (!includeDraft && "draft" in this.getAttributes()) {
                    return await this.findAll({
                        where: {[key]: id, deleted: deleted, draft: false},
                        raw: true
                    });
                } else {
                    return await this.findAll({
                        where: {[key]: id, deleted: deleted},
                        raw: true
                    });
                }
            } catch (err) {
                if (isInternalDatabaseError(err)) {
                    throw InternalDatabaseError(err);
                }
            }
        } else {
            throw InternalDatabaseError("DB MetaModel Class " + key + " not available: " + this.constructor.name)
        }
    }

    static async add(data) {
        try {
            if ("hash" in this.getAttributes()) {
                data.hash = uuidv4();
            }

            return (await this.create(data)).get({plain: true});
        } catch (err) {
            if (isInternalDatabaseError(err)) {
                throw InternalDatabaseError(err);
            } else {
                throw err;
            }
        }
    }

    static async updateById(id, data) {
        const possibleFields = Object.keys(this.getAttributes()).filter(key => !['id', 'createdAt', 'updateAt', 'passwordHash', 'lastLoginAt', 'salt'].includes(key));

        if (data.deleted) {
            data.deletedAt = Date.now();
        }

        try {
            return (await this.update(subselectFieldsForDB(data, possibleFields), {
                    where: {
                        id: id
                    },
                    returning: true,
                    plain: true
                }
            ))[1].dataValues;
        } catch (err) {
            if (isInternalDatabaseError(err)) {
                throw InternalDatabaseError(err);
            } else {
                throw err;
            }
        }

    }

}