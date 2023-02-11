/* Handle Collab in Database

Functions to modify the collaboration log in the database

Author: Nils Dycke, Dennis Zyska
*/
const {DataTypes, Op} = require("sequelize")
const db = require("../index.js")
const {isInternalDatabaseError, InternalDatabaseError} = require("../utils");

const Collab = require("../models/collab.js")(db.sequelize, DataTypes);

exports.get = async function get(id) {
    try {
        return await Collab.findOne({
            where: {
                id: id,
            },
            raw: true
        });
    } catch (err) {
        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        } else {
            throw err;
        }
    }
}

exports.getAll = async function getAll() {
    try {
        return await Collab.findAll({
            where: {
                delete: false,
            },
            raw: true
        });
    } catch (err) {
        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        } else {
            throw err;
        }
    }
}

exports.add = async function add(data) {

    try {
        return (await Collab.create(data)).get({plain: true})
    } catch (err) {
        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        }
    }
}

exports.update = async function update(id) {

    try {
        return await Collab.update({timestamp: Date.now()}, {
            where: {
                id: id
            },
            returning: true,
            plain: true
        });
    } catch (err) {
        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        } else {
            throw err;
        }
    }
}

exports.delete = async function _delete(id) {

    try {
        return await Collab.update({delete: true}, {
            where: {
                id: id
            },
            returning: true,
            plain: true
        });
    } catch (err) {
        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        } else {
            throw err;
        }
    }
}

