/* Handle Documents in Database

Functions to modify the documents in the database

Author: Nils Dycke (dycke@ukp.informatik...)
*/
const {v4: uuidv4} = require("uuid");

const {DataTypes, Op} = require("sequelize")
const db = require("../index.js")
const {isInternalDatabaseError, InternalDatabaseError, subselectFieldsForDB} = require("./utils");
const Document = require("../models/document.js")(db.sequelize, DataTypes);

function InvalidDocumentParameters(details) {
    return {
        name: "InvalidDocumentParameters",
        message: details,
        toString: function () {
            return this.name + ": " + this.message;
        }
    };
}

exports.add = async function add(doc_name, user_id) {
    let hash;
    let duplicates;
    while (true) {
        hash = uuidv4();

        try {
            duplicates = await Document.count({
                where: {
                    hash: hash
                }
            });
        } catch (err) {
            if (isInternalDatabaseError(err)) {
                throw InternalDatabaseError(err);
            } else {
                throw err;
            }
        }

        if (duplicates === 0) {
            break;
        }
    }

    try {
        return (await Document.create({
            name: doc_name, hash: hash, userId: user_id,
        })).get({plain: true});
    } catch (err) {
        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        } else {
            throw InvalidDocumentParameters("Provided document name or user ID are invalid.");
        }
    }
}

exports.dbGetDoc = async function getDoc(id) {
    try {
        return await Document.findOne({where: {'id': id},
            raw: true});
    } catch (err) {
        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        } else {
            throw InvalidDocumentParameters("Provided document hash does not exist");
        }
    }
}

exports.dbGetIdByHash = async function getIdByHash(hash) {
    try {
        return (await Document.findOne({where: {'hash': hash}, attributes: ['id'], raw: true}))['id'];
    } catch (err) {
        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        } else {
            throw InvalidDocumentParameters("Provided document hash does not exist");
        }
    }
}

exports.deleteDoc = async function deleteDoc(doc_id) {
    try {
        return await Document.update({deleted: true, deletedAt: new Date()}, {
            where: {
                id: doc_id
            },
            returning: true,
            plain: true
        });
    } catch (err) {
        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        } else {
            throw InvalidDocumentParameters("Provided document ID does not exist");
        }
    }
}

exports.update = async function update(documentId, document) {
    try {
        return await Document.update(subselectFieldsForDB(document, ["name", "hash", "public", "deleted"]), {
            where: {
                id: documentId
            },
            returning: true,
            plain: true
        });
    } catch (err) {
        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        } else {
            throw err;
        }
    }

}

exports.getAll = async function getAll(user_id = null) {
    try {
        if (user_id === null) {
            return await Document.findAll({where: {deleted: false}, raw: true});
        } else {
            return await Document.findAll({where: {[Op.or]: [{userId: user_id, public: true}], deleted: false}, raw: true});
        }
    } catch (err) {
        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        } else {
            throw InvalidDocumentParameters("Provided user ID is invalid. Cannot find associated documents.");
        }
    }
}