/* Handle Comments in Database

Functions to modify the comments in the database

Author: Nils Dycke (dycke@ukp.informatik...)
*/
const {DataTypes, Op} = require("sequelize")
const db = require("../index.js")
const {isInternalDatabaseError, InternalDatabaseError, subselectFieldsForDB, pickObjectAttributeSubset} = require("./utils");
const {resolveUserIdToName} = require("./user");
const {v4: uuidv4} = require("uuid");
const {getByIds: getTagsByIds} = require("./tag");
const {resolveAnnoIdToHash} = require("./annotation");

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
        userId: user_id,
        documentId: document_id,
        referenceAnnotation: annotation_id,
        referenceComment: comment_id
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
                documentId: doc_id, deleted: false, draft: false
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


exports.loadDocumentComments = async function load(doc_id) {
    try {
        return await Comment.findAll({
            where: {
                documentId: doc_id, deleted: false, draft: false, referenceAnnotation: null
            }
        });
    } catch (err) {
        throw InternalDatabaseError(err);
    }

}

async function resolveCommentIdToHash(commentId) {
    try {
        const comm = await Comment.findOne({
            where: {
                id: commentId, deleted: false, draft: false
            }
        });
        return comm != null ? comm.hash : null;
    } catch (err) {
        throw InternalDatabaseError(err);
    }
}
exports.resolveCommentIdToHash = resolveCommentIdToHash;


exports.formatForExport = async function format(comment) {
    const copyFields = [
        "hash",
        "text",
        "document",
        "createdAt",
        "updatedAt"
    ]

    let copied = pickObjectAttributeSubset(comment, copyFields);
    copied.userId = await resolveUserIdToName(comment.userId);
    copied.tags = JSON.parse(comment.tags);
    copied.referenceAnnotation = await resolveAnnoIdToHash(comment.referenceAnnotation);
    if(comment.referenceComment) {
        copied.referenceComment = await resolveCommentIdToHash(comment.referenceComment);
    } else {
        copied.referenceComment = null;
    }

    return copied
}
