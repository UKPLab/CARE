/* Handle Annotation in Database

Functions to modify the annotations in the database

Author: Nils Dycke (dycke@ukp.informatik...)
*/
const {DataTypes, Op} = require("sequelize")
const db = require("../index.js")
const {isInternalDatabaseError, InternalDatabaseError} = require("./utils");

const Annotation = require("../models/annotation.js")(db.sequelize, DataTypes);
const Comment = require("../models/comment.js")(db.sequelize, DataTypes);

function InvalidAnnotationParameters(details) {
    return {
        name: "InvalidAnnotationParameters",
        message: details,
        toString: function() {return this.name + ": " + this.message;}
    };
}

function InvalidCommentParameters(details) {
    return {
        name: "InvalidCommentParameters",
        message: details,
        toString: function() {return this.name + ": " + this.message;}
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
    }catch (err) {
             throw err;

        }


}

exports.getAnnoFromDocRaw = async function getAnnoFromDocRaw(document) {
    try {
        let annotations =  await Annotation.findAll({ where: { 'document': document}});
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

exports.add = async function add(annotation, comment = null) {
    let anno;
    try {
        //TODO without checking we add the given user as creator to the DB, that is incorrect -- we need to use the one of the session
        anno = await Annotation.create({
            hash: annotation.annotation_id,
            creator: annotation.user,
            text: annotation.annotation.target === undefined ? null : annotation.annotation.target[0].selector[1].exact,
            document: annotation.document_id,
            selectors: annotation.annotation.target === undefined ? null : annotation.annotation.target,
            draft: annotation.draft,
            tags: String.toString(annotation.tags),
            createdAt: new Date(),
            updatedAt: new Date()
        });
    } catch (err) {
        if(isInternalDatabaseError(err)){
            throw InternalDatabaseError(err);
        } else if(err.parent !== undefined && err.parent.message.match("value too long for type character varying") != null) {
            throw InvalidAnnotationParameters("Maximum selection length exceeded");
        } else {
            throw InvalidAnnotationParameters("Document or user ID incorrect");
        }
    }

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
             if(isInternalDatabaseError(err)){
                throw err;
            } else {
                throw InvalidCommentParameters("Provided comment invalid");
            }
        }
    }

    return anno;
}

exports.deleteAnno = async function deleteAnno(annoId) {
    try {
        return await Annotation.update({deleted: true, deletedAt: new Date()}, {
            where: {
                hash: annoId
            }
        });
    } catch (err) {
        if(isInternalDatabaseError(err)){
            throw InternalDatabaseError(err);
        } else {
            throw InvalidAnnotationParameters("Annotation-to-delete non-existent");
        }
    }
}

exports.updateAnno = async function updateAnno(annoId, newSelector = null, newText = null, newComment = null, newTags = null) {
    let newValues = {updatedAt: new Date(), draft: false};

    if (newSelector != null) {
        newValues.selector = newSelector;
    }
    if (newText != null) {
        newValues.text = newText;
    }
    if (newTags != null) {
        newValues.tags = newTags.length > 0 ? newTags.join() : ""
    }

    try {
        await Annotation.update(newValues, {
            where: {
                hash: annoId
            }
        });
    } catch (e) {
        if(isInternalDatabaseError(err)){
            throw InternalDatabaseError(err);
        } else {
            //todo catch difference: annotation not existent vs. values invalid
            throw InvalidAnnotationParameters("Update values for annotation invalid");
        }
    }

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
                if(isInternalDatabaseError(err)){
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
                if(isInternalDatabaseError(err)){
                    throw InternalDatabaseError(err);
                } else {
                    //todo catch difference: comment not existent vs. values invalid
                    throw InvalidCommentParameters("Comment invalid");
                }
            }
        }
    }
}

exports.loadByDocument = async function load(docId) {
    console.log("loading annos");
    let annotations;
    try {
        annotations = await Annotation.findAll({
            where: {
                document: docId, deleted: false, draft: false
            }
        });
    } catch (err) {
        throw InternalDatabaseError(err);
    }

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
}

exports.toFrontendRepresentationAnno = function toFrontend(annotation) {
    return {
        annotation_id: annotation.hash,
        document_id: annotation.document,
        text: annotation.text,
        tags: annotation.tags != null ? annotation.tags.split(",") : null,
        annotation: {target: annotation.selectors},
        user: annotation.creator
    }
}

exports.toFrontendRepresentationComm = function toFrontend(comment) {
    return comment.map(c => {
        return {
            comment_id: c.hash,
            referenced_annotation: c.referenceAnnotation,
            text: c.text,
            tags: c.tags != null ? c.tags.split(",") : null,
            user: c.creator
        };
    });
}

exports.mergeAnnosAndComments = function mergeAnnosAndCommentsFrontendRepresentation(annotationsWithComments){
    //expects array [annotations, comments]
    return annotationsWithComments.map(x => {
       const annos = Object.fromEntries(x[0].map(a => [a.hash, toFrontendRepresentationAnno(a)]));
       const comments = Object.fromEntries(Object.entries(x[1]).map(c => [c[0], toFrontendRepresentationComm(c[1])[0]]));

       return Object.entries(annos).map(x => {
          if(x[0] in comments){
              const c = comments[x[0]];
              const addFields = Object.fromEntries(Object.entries(c).map(e => ["comment_"+e[0], e[1]]));

              return Object.assign(x[1], addFields);
          } else {
              return x[1];
          }
       });
    });
}