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
const Comment = require("../models/comment.js")(db.sequelize, DataTypes);
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

function InvalidCommentParameters(details) {
    return {
        name: "InvalidCommentParameters",
        message: details,
        toString: function () {
            return this.name + ": " + this.message;
        }
    };
}

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


}

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
        hash: uuidv4(),
        text: annotation.selectors.target === undefined ? null : annotation.selectors.target[0].selector[1].exact,
        tags: [],
        selectors: {},
        draft: true,
    }

    try {
        return (await Annotation.create(Object.assign(Object.assign(newAnnotation, annotation), {creator: user_id}))).get({plain: true});
    } catch (err) {
        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        } else if (err.parent !== undefined && err.parent.message.match("value too long for type character varying") != null) {
            throw InvalidAnnotationParameters("Maximum selection length exceeded");
        } else {
            throw InvalidAnnotationParameters("Document or user ID incorrect");
        }
    }

    /*
    if (comment != null) {
        try {
            await Comment.create({
                hash: comment.id,
                creator: comment.user,
                text: comment.text,
                referenceAnnotation: annotation.annotation_id,
                referenceComment: null,
                tags: comment.tags,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        } catch (err) {
            if (isInternalDatabaseError(err)) {
                throw err;
            } else {
                throw InvalidCommentParameters("Provided comment invalid");
            }
        }
    }*/

}

exports.update = async function update(data) {

    try {
        return await Annotation.update(subselectFieldsForDB(data, ["deleted", "text", "tags", "draft"]), {
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

    /*

    if (newComment != null) {
        const cid = newComment.id;

        let comment;
        try {
            comment = await Comment.findAll({
                where: {
                    hash: cid
                }
            });
        } catch (err) {
            throw InternalDatabaseError(err);
        }

        if (comment.length > 0) {
            const newCValues = {
                text: newComment.text,
                referenceAnnotation: annoId,
                referenceComment: null,
                tags: newComment.tags !== undefined && newComment.tags.length > 0 ? newComment.tags.join() : "",
                updatedAt: new Date()
            }

            try {
                await Comment.update(newCValues, {
                    where: {
                        hash: cid
                    }
                });
            } catch (err) {
                if (isInternalDatabaseError(err)) {
                    throw InternalDatabaseError(err);
                } else {
                    //todo catch difference: comment not existent vs. values invalid
                    throw InvalidCommentParameters("Update values for comment invalid");
                }
            }
        } else {
            try {
                await Comment.create({
                    hash: newComment.id,
                    creator: newComment.user,
                    text: newComment.text,
                    referenceAnnotation: annoId,
                    referenceComment: null,
                    tags: newComment.tags !== undefined && newComment.tags !== null && newComment.tags.length > 0 ? newComment.tags.join() : "",
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            } catch (err) {
                if (isInternalDatabaseError(err)) {
                    throw InternalDatabaseError(err);
                } else {
                    //todo catch difference: comment not existent vs. values invalid
                    throw InvalidCommentParameters("Comment invalid");
                }
            }
        }


    }*/
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
    /*
    let comments = Object();
    for (const a of annotations) {
        try {
            comments[a.hash] = await Comment.findAll({
                where: {
                    referenceAnnotation: a.hash
                }
            });
        } catch (err) {
            throw InternalDatabaseError(err);
        }
    }

    return [annotations, comments];

     */
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
        "draft",
        "deleted",
        "deletedAt",
        "createdAt",
        "updatedAt"
    ]

    let copied = pickObjectAttributeSubset(annotation, copyFields);
    copied.creator = await resolveUserIdToName(annotation.creator);
    copied.tags = await getTagsByIds(JSON.parse(annotation.tags).map(t => t.name));

    return copied
}

/*
async function toFrontendRepresentationAnno(annotation) {
    return {
        annotation_id: annotation.hash,
        document_id: annotation.document,
        text: annotation.text,
        tags: annotation.tags != null ? annotation.tags.split(",") : null,
        annotation: {target: annotation.selectors},
        user: await resolveUserIdToName(annotation.creator)
    }
}

exports.toFrontendRepresentationAnno = toFrontendRepresentationAnno

async function toFrontendRepresentationComm(comment) {
    return await Promise.all(comment.map(async c => {
        return {
            comment_id: c.hash,
            referenced_annotation: c.referenceAnnotation,
            text: c.text,
            tags: c.tags != null ? c.tags.split(",") : null,
            user: await resolveUserIdToName(c.creator)
        };
    }));
}

exports.toFrontendRepresentationComm = toFrontendRepresentationComm

exports.mergeAnnosAndComments = async function mergeAnnosAndCommentsFrontendRepresentation(annotationsWithComments) {
    //expects array [annotations, comments]
    return await Promise.all(annotationsWithComments.map(async x => {
            const annos = Object.fromEntries(await Promise.all(x[0].map(async a => [a.hash, await toFrontendRepresentationAnno(a)])));
            const comments = Object.fromEntries(await Promise.all(Object.entries(x[1]).map(async c => [c[0], await toFrontendRepresentationComm(c[1])[0]])));

            return Object.entries(annos).map(x => {
                if (x[0] in comments && comments[x[0]] !== undefined) {
                    const c = comments[x[0]];
                    const addFields = Object.fromEntries(Object.entries(c).map(e => ["comment_" + e[0], e[1]]));

                    return Object.assign(x[1], addFields);
                } else {
                    return x[1];
                }
            });
        })
    );
}
*/