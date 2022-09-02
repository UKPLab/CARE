/* Handle Logs in Database

Functions to add logging into database

Author: Dennis Zyska (zyska@ukp...)
*/
const {DataTypes, Op} = require("sequelize")
const db = require("../index.js")

const Statistic = require("../models/statistic.js")(db.sequelize, DataTypes);

exports.add = async function add(action, data, user) {
    try {
        await Statistic.create({
            action: action,
            data: JSON.stringify(data),
            user: user,
            timestamp: new Date(),
        });
    } catch(e) {
        console.log("Can't put statistics into the database: " + e);
    }

}
