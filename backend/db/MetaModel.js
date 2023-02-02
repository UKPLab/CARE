const {Model, Op} = require("sequelize");
const {isInternalDatabaseError, InternalDatabaseError, subselectFieldsForDB} = require("./methods/utils");

module.exports = class MetaModel extends Model {


    static async getAll() {
        try {
            return await this.findAll({where: {deleted: false}, raw: true});
        } catch (err) {
            if (isInternalDatabaseError(err)) {
                throw InternalDatabaseError(err);
            }
        }
    }

    static async delete(id) {
        try {
            return await this.update({'deleted': true}, {
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

    static async add(data) {
        try {
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
        const possibleFields = Object.keys(this.getAttributes()).filter(key => !['id', 'createdAt', 'updateAt', 'passwordHash', 'lastLoginAt', 'salt'].includes(key))
        try {
            return await this.update(subselectFieldsForDB(data, possibleFields), {
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

}