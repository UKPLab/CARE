/* Handle Users in Database

Functions to modify the users in the database

Author: Nils Dycke (dycke@ukp.informatik...)
*/
const {DataTypes, Op} = require("sequelize")
const db = require("../models/index.js")
const User = require("../models/user.js")(db.sequelize, DataTypes);

const {genSalt, genPwdHash} = require("./utils.js");
const {InternalDatabaseError, isInternalDatabaseError} = require("./utils");

const logger = require("../../utils/logger.js")( "db/user");

function DuplicateUserException() {
    return {
        name: "DuplicateUserException",
        message: "Provided user name or email already exist.",
        toString: function() {return this.name + ": " + this.message;}
    };
}

function InvalidPasswordException() {
    return {
        name: "InvalidCredentialsException",
        message: "The provided password is invalid.",
        toString: function() {return this.name + ": " + this.message;}
    };
}

function validatePassword(password) {
    return password != null && password.length > 0;
}


exports.add = async function add(user_name, first_name, last_name, user_email, password, role) {
    if(!validatePassword(password)){
        throw InvalidPasswordException();
    }

    const salt = genSalt();
    let pwdHash = await genPwdHash(password, salt);

    try {
        return await User.create({
            sysrole: role,
            first_name: first_name,
            last_name: last_name,
            user_name: user_name,
            email: user_email,
            password_hash: pwdHash,
            salt: salt
        });
    } catch (err) {
        if(isInternalDatabaseError(err)){
            throw InternalDatabaseError(err);
        } else {
            throw DuplicateUserException()
        }
    }
}

exports.relevantFields = function fields(user) {
    const exclude = ["password_hash", "salt"]

    const entries = Object.entries(user.dataValues);
    const filtered = entries.filter(([k, v]) => exclude.indexOf(k) === -1);

    return Object.fromEntries(filtered);
}

exports.minimalFields = function minimalFields(user) {
    const include = ["id", "user_name"]

    const entries = Object.entries(user.dataValues);
    const filtered = entries.filter(([k, v]) => include.indexOf(k) !== -1);

    return Object.fromEntries(filtered);
}

exports.find = async function find(username) {
    try {
        return await User.findAll({
            where: {
                [Op.or]: [{
                    user_name: username
                }, {
                    email: username
                }]
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