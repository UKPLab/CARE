const {DataTypes, Op} = require("sequelize")
const db = require("../index.js")
const {isInternalDatabaseError, InternalDatabaseError} = require("./utils");

const Settings = require("../models/setting.js")(db.sequelize, DataTypes);

exports.getSettings = async function getSettings() {
   try {
        return await Settings.findAll({
            where: {
                deleted: false,
                userId: null,
            }
        });
    } catch (err) {
        if(isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        }
    }
}


exports.getUserSettings = async function getUserSettings(user_id) {
   try {
        return await Settings.findAll({
            where: {
                deleted: false,
                [Op.or]: [{userId: null}, {userId: user_id}]
            }
        });
    } catch (err) {
        if(isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        }
    }
}

