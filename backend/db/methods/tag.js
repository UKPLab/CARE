/* Interact wiht Tags

Functions to handle the available tags assignable to annotations. They are currently stored as a
table of tags that are mostly constant.

Author: Nils Dycke (dycke@ukp...)
*/
const {DataTypes, Op} = require("sequelize")
const db = require("../models/index.js")

const Tag = require("../models/tag.js")(db.sequelize, DataTypes);
const logger = require("../../utils/logger.js")( "db/tag");

const {isInternalDatabaseError, InternalDatabaseError} = require("./utils");


function InvalidTagParameters(details) {
    return {
        name: "InvalidTagParameters",
        message: details,
        toString: function() {return this.name + ": " + this.message;}
    };
}


exports.add = async function add(tag_name, description) {
    try {
        const t = await Tag.create({
            name: tag_name,
            description: description
        });
        return t.id;
    } catch(err) {
        logger.error("Cant add tag to database" + err);

        if(isInternalDatabaseError(err)) {
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
         if(isInternalDatabaseError(err)) {
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
        if(isInternalDatabaseError(err)) {
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
        if(isInternalDatabaseError(err)) {
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