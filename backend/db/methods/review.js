/* Handle Logs in Database

Functions to handle review in the database

Author: Dennis Zyska (zyska@ukp...)
*/
const {DataTypes, Op} = require("sequelize")
const db = require("../models/index.js")
const {v4: uuidv4} = require("uuid");

const Review = require("../models/review.js")(db.sequelize, DataTypes);
const logger = require("../../utils/logger.js")( "db/review");

exports.add = async function add(document_id, user_id) {
    let hash = uuidv4();

    try {
        await Review.create({
            startAt: new Date(),
            startBy: user_id,
            document: document_id,
            hash: hash,
        });
        return hash;
    } catch(e) {
        logger.error("Cant add review workflow into database" + e);
    }
    return null;

}

exports.get = async function get(review_id) {
    try {
        return await Review.findOne({ where: { 'hash': review_id}});
    } catch (err) {
        logger.error("Cant find review workflow " + review_id + " in database: " + err);
    }

}

exports.update = async function update(review_id, data) {
    try {
        data.updatedAt = new Date();
        await Review.update(data, {
            where: {
                hash: review_id
            }
        });
        return true;
    } catch (err) {
        logger.error("Cant update review workflow " + review_id + " in database: " + err);
    }
    return false;
}