/* Handle Users in Database

Functions to modify the users in the database

Author: Nils Dycke (dycke@ukp.informatik...)
*/
const {DataTypes, Op} = require("sequelize")
const db = require("../models/index.js")
const User = require("../models/user.js")(db.sequelize, DataTypes);

const {genSalt, genPwdHash} = require("./utils.js");

exports.add = async function add(user_name, first_name, last_name, user_email, password, role) {
    //TODO: doesn't fail when a user with this name/email already exsists: fix

    const salt = genSalt();
    let pwdHash = await genPwdHash(password, salt);

    return User.create({
        sysrole: role,
        first_name: first_name,
        last_name: last_name,
        user_name: user_name,
        email: user_email,
        password_hash: pwdHash,
        salt: salt
    });
}

exports.relevantFields = function fields(user) {
    const exclude = ["password_hash", "salt"]

    const entries = Object.entries(user.dataValues);
    const filtered = entries.filter(([k, v]) => exclude.indexOf(k) === -1);

    return Object.fromEntries(filtered);
}

exports.find = async function find(username) {
    return User.findAll({
        where: {
            [Op.or]: [{
                user_name: username
            }, {
                email: username
            }]
        }
    });
}