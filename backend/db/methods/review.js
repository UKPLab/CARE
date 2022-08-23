/* Handle Logs in Database

Functions to handle review in the database

Author: Dennis Zyska (zyska@ukp...)
*/
const {DataTypes, Op} = require("sequelize")
const db = require("../models/index.js")
const {v4: uuidv4} = require("uuid");

const Review = require("../models/review.js")(db.sequelize, DataTypes);
const logger = require("../../utils/logger.js")( "db/review");

const { get: getUser } = require("../../db/methods/user.js");
const path = require("path");

exports.add = async function add(document_id, user_id) {
    let hash = uuidv4();

    //skip for now
    /*try {
        const exists = await Review.findOne({
            where: {
                document: document_id,
                startBy: user_id
            }
        });
        if(exists != null){
            return null;
        }
    } catch(e) {
        logger.error("Cant check for review workflow into database" + e);
        return null;
    }*/

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

exports.toReadable = async function toReadableFields(review) {
    let result = review.dataValues;

    try {
        const reviewBy = await getUser(review.startBy);
        result.startBy = reviewBy.user_name;

        if(review.decisionBy !== null){
            const decisionBy = await getUser(review.decisionBy);
            result.decisionBy = decisionBy.user_name;
        }
    } catch (err) {
        logger.error("Failed to translate review into usable form." + err);
    }

    return result;
}

exports.get = async function get(review_id) {
    try {
        return await Review.findOne({ where: { 'hash': review_id}});
    } catch (err) {
        logger.error("Cant find review workflow " + review_id + " in database: " + err);
    }
    return null;
}

exports.getByUser = async function get(user_id) {
    try {
        return await Review.findAll({ where: { startBy: user_id}});
    } catch (err) {
        logger.error("Cant search for review workflows for user " + user_id + " in database: " + err);
    }
    return null;
}

exports.getMetaByUser = async function get(user_id) {
    try {
        return await Review.findAll({ where: { decisionBy: user_id}});
    } catch (err) {
        logger.error("Cant search for review workflows for user " + user_id + " in database: " + err);
    }
    return null;
}

exports.getAll = async function getAll() {
    try {
        return await Review.findAll()
    } catch (err) {
        logger.error("Cant retrieve review workflow for all users from database: " + err);
    }
    return null;
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
