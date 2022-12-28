/* Handle Annotation in Database

Functions to modify the annotations in the database

Author: Nils Dycke (dycke@ukp.informatik...)
*/
const {DataTypes, Op} = require("sequelize")
const db = require("../index.js")
const {isInternalDatabaseError, InternalDatabaseError, subselectFieldsForDB, pickObjectAttributeSubset} = require("./utils");
const {resolveUserIdToName} = require("./user");
const {v4: uuidv4} = require("uuid");

const {getByIds: getTagsByIds} = require('../../db/methods/tag.js')

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


/*
exports.addRawComment = async function addRawComment(comment) {
    try {
        return await Comment.create(comment);
    } catch (err) {
        throw err;
    }
}

exports.addRaw = async function addRaw(annotation) {
    try {
        let anno = await Annotation.create(annotation);
        return anno;
    } catch (err) {
        throw err;

    }


}*/
/*
exports.getAnnoFromDocRaw = async function getAnnoFromDocRaw(document) {
    try {
        let annotations = await Annotation.findAll({where: {'document': document}});
        for (let anno of annotations) {
            anno['comments'] = await Comment.findAll({
                where: {
                    referenceAnnotation: anno.hash
                }
            });
        }

        return annotations
    } catch (err) {
        throw err;
    }
}*/

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
        hash: uuidv4(),
        text: annotation.selectors.target === undefined ? null : annotation.selectors.target[0].selector[1].exact,
        selectors: {},
        draft: true,
    }

    try {
        return (await Annotation.create(Object.assign(Object.assign(newAnnotation, annotation), {userId: user_id}))).get({plain: true});
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
        return await Annotation.update(subselectFieldsForDB(Object.assign(data, {draft: false}), ["deleted", "text", "tag", "draft"]), {
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

exports.loadByDocument = async function load(docId) {
    try {
        return await Annotation.findAll({
            where: {
                document: docId, deleted: false, draft: false
            },

            raw: true
        });
    } catch (err) {
        throw InternalDatabaseError(err);
    }

}

async function resolveAnnoIdToHash(annoId) {
    try {
        const anno = await Annotation.findOne({
            where: {
                id: annoId, deleted: false, draft: false
            }
        });
        return anno != null ? anno.hash : null;
    } catch (err) {
        throw InternalDatabaseError(err);
    }
}
exports.resolveAnnoIdToHash = resolveAnnoIdToHash;

exports.formatForExport = async function format(annotation) {
    const copyFields = [
        "hash",
        "text",
        "document",
        "createdAt",
        "updatedAt"
    ]

    let copied = pickObjectAttributeSubset(annotation, copyFields);
    copied.userId = await resolveUserIdToName(annotation.userId);
    copied.tag = (await getTagsByIds(annotation.tag))[0].name;

    return copied
}