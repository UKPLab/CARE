const { DataTypes, Op } = require("sequelize")
const db = require("../models/index.js")

const Annotation  = require("../models/annotation.js")(db.sequelize, DataTypes);
const Comment  = require("../models/comment.js")(db.sequelize, DataTypes);

exports.add = async function add(annotation, comment=null) {
    const anno = await Annotation.create({
        hash: annotation.annotation_id,
        creator: annotation.user,
        text: annotation.annotation.target[0].selector[1].exact,
        document: annotation.document_id,
        selectors: annotation.annotation.target,
        createdAt: new Date(),
        updatedAt: new Date()
    });

    if(comment != null){
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
    }

    return anno;
}

exports.deleteAnno = async function deleteAnno(annoId) {
    return Annotation.update({deleted: true, deletedAt: new Date()}, {
        where: {
            hash: annoId
        }
    });
}

exports.updateAnno = async function updateAnno(annoId, newSelector = null, newText = null, newComment = null, newTags = null) {
    let newValues = {updatedAt: new Date()};
    const updateAnno = newSelector != null || newText != null || newTags != null;

    if(newSelector != null){
        newValues.selector = newSelector;
    }
    if(newText != null){
        newValues.text= newText;
    }
    if(newTags != null){
        newValues.tags = newTags.toString()
    }

    console.log("updated values");
    console.log(newValues);
    console.log(annoId);
    console.log(updateAnno);

    if(updateAnno){
        await Annotation.update(newValues, {
            where: {
                hash: annoId
            }
        });
    }

    if(newComment != null){
        const cid = newComment.id;

        const comment = await Comment.findAll({
            where: {
                hash: cid
            }
        });

        if(comment.length > 0) {
            const newCValues = {
                text: newComment.text,
                referenceAnnotation: annoId,
                referenceComment: null,
                tags: newComment.tags.toString(),
                updatedAt: new Date()
            }

            await Comment.update(newCValues, {
                where: {
                     hash: cid
                }
            });
        } else {
            await Comment.create({
                hash: newComment.id,
                creator: newComment.user,
                text: newComment.text,
                referenceAnnotation: annoId,
                referenceComment: null,
                tags: newComment.tags.toString(),
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }
    }
}

exports.loadByDocument = async function load(docId) {
    const annotations = await Annotation.findAll({
        where: {
            document: docId,
            deleted: false
        }
    });

    const comments = annotations.map(async a => {
        return await Comment.findAll({
            referenceAnnotation: a.hash
        });
    });

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
    return {
        comment_id: comment.hash,
        referenced_annotation: comment.referenceAnnotation,
        text: comment.text,
        tags: comment.tags != null ? annotation.tags.split(",") : null,
        user: comment.creator
    }
}