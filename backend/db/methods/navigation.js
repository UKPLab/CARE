/* Handle Logs in Database

Functions to add logging into database

Author: Dennis Zyska (zyska@ukp...)
*/
const {DataTypes, Op} = require("sequelize")
const db = require("../index.js")
const {isInternalDatabaseError, InternalDatabaseError} = require("./utils");

const NavElement = require("../models/nav_element.js")(db.sequelize, DataTypes);
const NavGroup = require("../models/nav_group.js")(db.sequelize, DataTypes);

exports.getGroups = async function getGroups(action, data, user) {
    try {
        return await NavGroup.findAll({
            where: {
                deleted: false
            }
        });
    } catch (err) {
        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        }
    }
}

exports.getElements = async function getElements() {

    try {
        return await NavElement.findAll({
            where: {
                deleted: false
            }
        });
    } catch (err) {
        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        }
    }
}
