/* Handle Users in Database

Functions to modify the users in the database

Author: Nils Dycke (dycke@ukp.informatik...)
*/
const {DataTypes, Op} = require("sequelize")
const db = require("../index.js")
const User = require("../models/user.js")(db.sequelize, DataTypes);

const {genSalt, genPwdHash} = require("./utils.js");
const {InternalDatabaseError, isInternalDatabaseError} = require("./utils");

const logger = require("../../utils/logger.js")("db/user");

function DuplicateUserException() {
    return {
        name: "DuplicateUserException",
        message: "Provided user name or email already exist.",
        toString: function () {
            return this.name + ": " + this.message;
        }
    };
}

function InvalidPasswordException() {
    return {
        name: "InvalidPasswordException",
        message: "The provided password must be at least 8 characters.",
        toString: function () {
            return this.name + ": " + this.message;
        }
    };
}

function validatePassword(password) {
    return password != null && password.length >= 8;
}

exports.getUsername = async function getUsername(userId) {
    if (userId === null || userId === 0) {
        return "System";
    }
    try {
        const user = await User.findOne({where: {id: userId}});
        return user["userName"];
    } catch (err) {
        logger.error("Error while getting username with userid " + userId + ": " + err);
        throw new InternalDatabaseError();
    }
}

exports.getUserId = async function getUserId(userName) {
    try {
        const user = await User.findOne({where: {userName: userName}});
        return user["id"];
    } catch (err) {
        logger.error("Error while getting username with userid " + userId + ": " + err);
        throw new InternalDatabaseError();
    }
}

exports.add = async function add(user_name, first_name, last_name, user_email, password, role, terms, stats) {
    if (!validatePassword(password)) {
        throw InvalidPasswordException();
    }

    const salt = genSalt();
    let pwdHash = await genPwdHash(password, salt);

    try {
        return await User.create({
            sysrole: role,
            firstName: first_name,
            lastName: last_name,
            userName: user_name,
            email: user_email,
            passwordHash: pwdHash,
            salt: salt,
            acceptTerms: terms,
            acceptStats: stats,
        });
    } catch (err) {
        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        } else {
            throw DuplicateUserException()
        }
    }
}

exports.relevantFields = function fields(user) {
    const exclude = ["passwordHash", "salt"]

    const entries = Object.entries(user.dataValues);
    const filtered = entries.filter(([k, v]) => exclude.indexOf(k) === -1);

    return Object.fromEntries(filtered);
}

exports.minimalFields = function minimalFields(user) {
    const include = ["id", "userName"]

    const entries = Object.entries(user.dataValues);
    const filtered = entries.filter(([k, v]) => include.indexOf(k) !== -1);

    return Object.fromEntries(filtered);
}

exports.adminFields = function adminFields(user) {
    const include = ["id", "userName", "sysrole", "lastLoginAt"];

    const entries = Object.entries(user.dataValues);
    const filtered = entries.filter(([k, v]) => include.indexOf(k) !== -1);

    return Object.fromEntries(filtered);
}

exports.find = async function find(username) {
    try {
        return await User.findAll({
            where: {
                [Op.or]: [{
                    userName: username
                }, {
                    email: username
                }],
                [Op.not]: {
                    sysrole: "system"
                }
            }
        });
    } catch (err) {
        throw InternalDatabaseError(err);
    }
}

exports.get = async function get(userid) {
    try {
        return await User.findOne({
            where: {
                id: userid
            }
        });
    } catch (err) {
        throw InternalDatabaseError(err);
    }
}

exports.getAll = async function getAll() {
    try {
        return await User.findAll();
    } catch (err) {
        throw InternalDatabaseError(err);
    }
}

exports.resolveUserIdToName = async function resolveUserIdToName(userId) {
    try {
        return (await User.findOne({
            where: {
                id: userId
            }
        })).userName;
    } catch (err) {
        throw InternalDatabaseError(err);
    }
}

exports.update = async function update(userId, data) {
    try {
        data.updatedAt = new Date();
        await User.update(data, {
            where: {
                id: userId
            }
        });
        return true;
    } catch (err) {
        logger.error("Cant update user " + userId + " in database: " + err);
    }
    return false;
}