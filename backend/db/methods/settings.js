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
        if(isInternalDatabaseError(err)) {
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
        if(isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        }
    }
}

