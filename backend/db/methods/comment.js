/* Handle Comments in Database

Functions to modify the comments in the database

Author: Nils Dycke (dycke@ukp.informatik...)
*/
const {DataTypes, Op} = require("sequelize")
const db = require("../index.js")
const {isInternalDatabaseError, InternalDatabaseError, subselectFieldsForDB} = require("./utils");
const {resolveUserIdToName} = require("./user");
const {v4: uuidv4} = require("uuid");

const Comment = require("../models/comment.js")(db.sequelize, DataTypes);
const logger = require("../../utils/logger.js")("db/comment");


function InvalidCommentParameters(details) {
    return {
        name: "InvalidCommentParameters",
        message: details,
        toString: function () {
            return this.name + ": " + this.message;
        }
    };
}

exports.get = async function get(id) {
    try {
        return await Comment.findOne({
            where: {
                id: id
            },
            raw: true
        });
    } catch (err) {
        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        } else {
            throw err;
        }
    }
}

exports.add = async function add(document_id, annotation_id, comment_id, user_id) {

    let newComment = {
        hash: uuidv4(),
        tags: "[]",
        draft: true,
        creator: user_id,
        document: document_id,
        referenceAnnotation: annotation_id,
        referenceComment: comment_id
    }

    console.log(newComment);

    try {
        return (await Comment.create(newComment)).get({plain: true})
    } catch (err) {

        console.log(err);
        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        }
    }
}

exports.update = async function update(data) {

    try {
        return await Comment.update(subselectFieldsForDB(Object.assign(data, {draft: false}), ["deleted", "text", "tags", "draft"]), {
            where: {
                id: data["id"]
            },
            returning: true,
            plain: true
        });
    } catch (err) {
        logger.error("Cant add tag to database" + err);

        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        } else {
            throw err;
        }
    }
}

exports.loadByAnnotation = async function load(annoId) {
    try {
        return await Comment.findOne({
            where: {
                referenceAnnotation: annoId, deleted: false, draft: false
            },
            raw:true,
        });
    } catch (err) {
        throw InternalDatabaseError(err);
    }
}

exports.loadByDocument = async function load(doc_id) {
    try {
        return await Comment.findAll({
            where: {
                document: doc_id, deleted: false, draft: false
            }, raw: true
        });
    } catch (err) {
        throw InternalDatabaseError(err);
    }

}

exports.loadByComment = async function loadByComment(comment_id) {
    try {
        return await Comment.findAll({
            where: {
                referenceComment: comment_id, deleted: false, draft: false
            }, raw: true
        });
    } catch (err) {
        throw InternalDatabaseError(err);
    }

}