/* Interact with Tags

Functions to handle the available tags assignable to annotations. They are currently stored as a
table of tags that are mostly constant.

Author: Nils Dycke (dycke@ukp...), Dennis Zyska (zyska@ukp...)
*/
const {DataTypes, Op} = require("sequelize")
const db = require("../index.js")

const TagSet = require("../models/tag_set.js")(db.sequelize, DataTypes);
const logger = require("../../utils/logger.js")("db/tag_set");

const {isInternalDatabaseError, InternalDatabaseError, subselectFieldsForDB} = require("./utils");


function InvalidTagParameters(details) {
    return {
        name: "InvalidTagParameters", message: details, toString: function () {
            return this.name + ": " + this.message;
        }
    };
}


exports.add = async function add(tagset) {
    try {
        return await TagSet.create(subselectFieldsForDB(tagset, ["name", "description", "userId"]));
    } catch (err) {
        logger.error("Cant add tag to database" + err);

        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        } else {
            throw err;
        }
    }
}

exports.update = async function update(tagset) {
    try {
        return await TagSet.update(subselectFieldsForDB(tagset, ["name", "description"]), {
            where: {
                id: tagset["id"]
            },
            returning: true,
            plain: true
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

exports.publish = async function publish(tagsetId) {
    try {
        return await TagSet.update({public: true}, {
            where: {
                id: tagsetId
            },
            returning: true,
            plain: true
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

exports.remove = async function remove(tagset_id) {
    try {
        return await TagSet.update({deleted: true, deletedAt: new Date()}, {
            where: {
                id: tagset_id
            }, returning: true, plain: true
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
        return await TagSet.findAll({
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
        return await TagSet.findAll({
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

exports.get = async function get(tagset_id) {
    try {
        return await TagSet.findOne({
            where: {
                id: tagset_id
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