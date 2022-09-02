/* Handle Logs in Database

Functions to add logging into database

Author: Dennis Zyska (zyska@ukp...)
*/
const {DataTypes, Op} = require("sequelize")
const db = require("../index.js")

const Log = require("../models/log.js")(db.sequelize, DataTypes);

exports.add = async function add(info) {
    const {level, message, ...meta} = info;

    try {
        await Log.create({
            level: level,
            message: message,
            service: meta.service,
            user: meta.user !== undefined ? meta.user : null,
            timestamp: new Date(),
        });
    } catch(e) {
        console.log("Can't put log into the database: " + e);
        console.log("Log: ");
        console.log(info);
    }

}
