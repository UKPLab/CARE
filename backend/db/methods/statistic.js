/* Handle Logs in Database

Functions to add logging into database

Author: Dennis Zyska (zyska@ukp...)
*/
const {DataTypes, Op} = require("sequelize")
const db = require("../index.js")
const {isInternalDatabaseError, InternalDatabaseError} = require("../utils");

const Statistic = require("../models/statistic.js")(db.sequelize, DataTypes);

exports.add = async function add(action, data, user) {
    try {
        await Statistic.create({
            action: action,
            data: JSON.stringify(data),
            userId: user,
            timestamp: new Date(),
        });
    } catch (e) {
        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        } else {
            throw err;
        }
    }
}

exports.getByUser = async function getByUser(users) {
    if(!Array.isArray(users)){
        users = [users];
    }

    try {
        return await Statistic.findAll({
            where: {
                deleted: false,
                userId: users
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

exports.getAll = async function getAll() {

    try {
        return await Statistic.findAll({
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
