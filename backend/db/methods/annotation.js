const { DataTypes, Op } = require("sequelize")
const db = require("../models/index.js")

const Annotation  = require("../models/annotation.js")(db.sequelize, DataTypes);
const Comment  = require("../models/comment.js")(db.sequelize, DataTypes);

exports.add = async function add(annotation, comment=null) {
    console.log("adding anno");
    console.log(annotation);
    const anno = await Annotation.create({
        hash: annotation.annotation_id,
        creator: annotation.user,
        text: annotation.annotation.target[0].selector[1].exact,
        document: annotation.document_id,
        selectors: annotation.annotation.target,
        draft: annotation.draft,
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
    let newValues = {updatedAt: new Date(), draft: false};

    if(newSelector != null){
        newValues.selector = newSelector;
    }
    if(newText != null){
        newValues.text= newText;
    }
    if(newTags != null){
        newValues.tags = newTags.toString()
    }

     await Annotation.update(newValues, {
            where: {
                hash: annoId
            }
     });

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
            deleted: false,
            draft: false
        }
    });

    let comments = Object();

    for(const a of annotations) {
        comments[a.hash] = await Comment.findAll({
            where: {
                referenceAnnotation: a.hash
            }
        });
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