/* Handle Settings in Database

Functions to handle settings in the database

Author: Dennis Zyska (zyska@ukp...), Nils Dycke (dycke@ukp...)
*/
const {DataTypes, Op} = require("sequelize")
const db = require("../index.js")
const {isInternalDatabaseError, InternalDatabaseError} = require("./utils");

const Setting = require("../models/setting.js")(db.sequelize, DataTypes);
const UserSetting = require("../models/user_setting.js")(db.sequelize, DataTypes);

exports.getSettings = async function getSettings() {
    try {
        return await Setting.findAll({
            where: {
                deleted: false,
            }
        });
    } catch (err) {
        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        }
    }
}


exports.getUserSettings = async function getUserSettings(user_id) {
    try {
        return await UserSetting.findAll({
            where: {
                deleted: false,
                userId: user_id
            }
        });
    } catch (err) {
        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        }
    }
}

exports.setSetting = async function setSetting(key, value) {
    try {
        return await Setting.update({
            value: value
        }, {
            where: {
                key: key
            }
        });
    } catch (err) {
        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        }
    }
}

exports.setUserSetting = async function setUserSetting(user_id, key, value) {
    const dbObj = {
        userId: user_id,
        key: key,
        value: value
    };

    try {
        return await UserSetting.create(dbObj).then((msg) => {
            return msg;
        }).catch(async (err) => {
            return await UserSetting.update({value: value}, {where: {[Op.and]: [{userId: user_id}, {key: key}]}});
        });
    } catch (err) {
        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        }
    }
}

exports.setUserSettings = async function setUserSettings(user_id, settings) {
    // info: it's not working because of syntax error in sql generation - please don't use it!
    throw InternalDatabaseError("not implemented!");
    try {
        return UserSetting.bulkCreate(
            Object.keys(settings).map(key => {
                return {
                    userId: user_id,
                    key: key,
                    value: settings[key].toString()
                }
            }), {
                //TODO seems postgres throws an error
                updateOnDuplicate: ["key", "userId"]
            });
    } catch (err) {
        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        }
    }
}
