/* Interact with Tags

Functions to handle the available tags assignable to annotations. They are currently stored as a
table of tags that are mostly constant.

Author: Nils Dycke (dycke@ukp...)
Co-Author: Dennis Zyska (zyska@ukp...)
*/
const {DataTypes, Op} = require("sequelize")
const db = require("../index.js")

const Tag = require("../models/tag.js")(db.sequelize, DataTypes);
const logger = require("../../utils/logger.js")("db/tag");

const {isInternalDatabaseError, InternalDatabaseError, subselectFieldsForDB} = require("./utils");


function InvalidTagParameters(details) {
    return {
        name: "InvalidTagParameters", message: details, toString: function () {
            return this.name + ": " + this.message;
        }
    };
}


exports.add = async function add(tag) {
    try {
        return await Tag.create(subselectFieldsForDB(tag, ["name", "description", "colorCode", "userId", "setId"]));
    } catch (err) {
        logger.error("Cant add tag to database" + err);

        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        } else {
            throw err;
        }
    }
}

exports.update = async function update(tag) {
    try {
        return await Tag.update(subselectFieldsForDB(tag, ["name", "description", "colorCode", "setId"]), {
            where: {
                id: tag["id"]
            }
        });
    } catch (err) {
        logger.error("Cant add tag to database" + err);

        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        } else {
            throw err;
        }
    }
}

exports.publish = async function publish(tagId) {
    try {
        return await Tag.update({public: true}, {
            where: {
                id: tagId
            }
        });
    } catch (err) {
        logger.error("Cant add tag to database" + err);

        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        } else {
            throw err;
        }
    }
}

exports.remove = async function remove(tag_id) {
    try {
        return await Tag.update({deleted: true, deletedAt: new Date()}, {
            where: {
                id: tag_id
            }
        });
    } catch (err) {
        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        } else {
            throw InvalidTagParameters("Provided tag ID does not exist");
        }
    }
}

exports.getAll = async function getAll() {
    try {
        return await Tag.findAll({
            where: {
                deleted: false
            }
        });
    } catch (err) {
        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        } else {
            throw err;
        }
    }
}

exports.getAllByUser = async function getAllByUser(user_id, include_system = true, include_public = true) {

    let selector = [{userId: user_id}]
    if (include_system) {
        selector.push({userId: null})
    }
    if (include_public) {
        selector.push({public: true})
    }

    try {
        return await Tag.findAll({
            where: {
                deleted: false,
                [Op.or]: selector,
            }
        });
    } catch (err) {
        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        } else {
            throw err;
        }
    }
}

exports.get = async function get(tag_id) {
    try {
        return await Tag.findOne({
            where: {
                id: tag_id
            }
        });
    } catch (err) {
        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        } else {
            throw err;
        }
    }
}

exports.getAllBySetId = async function getAllBySetId(tagsetId) {
    try {
        return await Tag.findAll({
            where: {
                deleted: false,
                setId: tagsetId
            }
        });
    } catch (err) {
        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        } else {
            throw err;
        }
    }
}

exports.toFrontend = function toFrontend(tag) {
    const include = ["name", "description", "colorCode"]

    const entries = Object.entries(tag.dataValues);
    const filtered = entries.filter(([k, v]) => include.indexOf(k) !== -1);

    return Object.fromEntries(filtered);
}