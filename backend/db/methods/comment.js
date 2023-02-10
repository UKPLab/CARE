/* Handle Comments in Database

Functions to modify the comments in the database

Author: Nils Dycke, Dennis Zyska
*/
const {DataTypes, Op} = require("sequelize")
const db = require("../index.js")
const {isInternalDatabaseError, InternalDatabaseError, subselectFieldsForDB, pickObjectAttributeSubset} = require("./utils");
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

exports.add = async function add(data) {

    let newComment = {
        hash: uuidv4(),
        tags: "[]",
        draft: data.draft !== undefined ? data.draft : true,
        text: data.text !== undefined ? data.text : null,
        userId: data.userId,
        documentId: data.documentId,
        studySessionId: data.studySessionId,
        referenceAnnotation: data.annotationId !== undefined ? data.annotationId : null,
        referenceComment: data.commentId !== undefined ? data.commentId : null
    }

    try {
        return (await Comment.create(newComment)).get({plain: true})
    } catch (err) {
        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        }
    }
}

exports.update = async function update(data) {

    try {
        return await Comment.update(subselectFieldsForDB(Object.assign(data, {draft: false}), ["deleted", "text", "tags", "draft"]), {
            where: {
                id: data["commentId"]
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

exports.loadByDocument = async function load(documentId) {

    try {
        return await Comment.findAll({
            where: {
                documentId: documentId, deleted: false, draft: false
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


exports.loadDocumentComments = async function load(documentId) {
    try {
        return await Comment.findAll({
            where: {
                documentId: documentId, deleted: false, draft: false, referenceAnnotation: null
            }
        });
    } catch (err) {
        throw InternalDatabaseError(err);
    }

}


exports.formatForExport = async function format(comment) {
    const copyFields = [
        "id",
        "text",
        "documentId",
        "createdAt",
        "updatedAt",
    ]

    let copied = pickObjectAttributeSubset(comment, copyFields);
    copied.userId = await resolveUserIdToName(comment.userId);
    copied.tags = JSON.parse(comment.tags);

    if(comment.referenceAnnotation){
        copied.referenceAnnotation = comment.referenceAnnotation;
    } else {
        copied.referenceAnnotation = null;
    }

    if(comment.referenceComment) {
        copied.referenceComment = comment.referenceComment;
    } else {
        copied.referenceComment = null;
    }

    return copied;
}
