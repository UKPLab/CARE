/* Handle Annotation in Database

Functions to modify the annotations in the database

Author: Nils Dycke, Dennis Zyska
*/
const {DataTypes, Op} = require("sequelize")
const db = require("../index.js")
const {
    isInternalDatabaseError,
    InternalDatabaseError,
    subselectFieldsForDB,
    pickObjectAttributeSubset
} = require("./utils");
const {resolveUserIdToName} = require("./user");
const {v4: uuidv4} = require("uuid");

const {get: getTagById} = require('../../db/methods/tag.js')

const Annotation = require("../models/annotation.js")(db.sequelize, DataTypes);
const logger = require("../../utils/logger.js")("db/annotation");

function InvalidAnnotationParameters(details) {
    return {
        name: "InvalidAnnotationParameters",
        message: details,
        toString: function () {
            return this.name + ": " + this.message;
        }
    };
}

exports.get = async function get(id) {
    try {
        return await Annotation.findOne({
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

exports.add = async function add(annotation, user_id) {


    let newAnnotation = {
        documentId: annotation.documentId,
        selectors: annotation.selectors,
        tagId: annotation.tagId,
        studySessionId: annotation.studySessionId,
        text: annotation.selectors.target === undefined ? null : annotation.selectors.target[0].selector[1].exact,
        draft: true,
    }

    try {
        return (await Annotation.create(Object.assign(newAnnotation, {userId: user_id}))).get({plain: true});
    } catch (err) {
        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        } else if (err.parent !== undefined && err.parent.message.match("value too long for type character varying") != null) {
            throw InvalidAnnotationParameters("Maximum selection length exceeded");
        } else {
            throw InvalidAnnotationParameters("Document or user ID incorrect");
        }
    }


}

exports.update = async function update(data) {

    try {
        return await Annotation.update(subselectFieldsForDB(Object.assign(data, {draft: false}), ["deleted", "text", "tagId", "draft"]), {
            where: {
                id: data["annotationId"]
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

exports.loadByDocument = async function load(documentId) {

    try {
        return await Annotation.findAll({
            where: {
                documentId: documentId, deleted: false, draft: false
            },

            raw: true
        });
    } catch (err) {
        throw InternalDatabaseError(err);
    }

}

exports.formatForExport = async function format(annotation) {
    const copyFields = [
        "text",
        "id",
        "documentId",
        "createdAt",
        "updatedAt"
    ]

    let copied = pickObjectAttributeSubset(annotation, copyFields);
    copied.userId = await resolveUserIdToName(annotation.userId);
    copied.tag = (await getTagById(annotation.tagId)).name;

    return copied
}