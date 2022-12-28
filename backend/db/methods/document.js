/* Handle Documents in Database

Functions to modify the documents in the database

Author: Nils Dycke (dycke@ukp.informatik...)
*/
const {v4: uuidv4} = require("uuid");

const {DataTypes, Op} = require("sequelize")
const db = require("../index.js")
const {isInternalDatabaseError, InternalDatabaseError} = require("./utils");
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
        return await Document.create({
            name: doc_name, hash: hash, userId: user_id,
        });
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
        return await Document.findOne({where: {'id': id}});
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
            }
        });
    } catch (err) {
        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        } else {
            throw InvalidDocumentParameters("Provided document ID does not exist");
        }
    }
}

exports.rename = async function rename(doc_id, name) {
    try {
        return await Document.update({name: name}, {
            where: {
                id: doc_id
            }
        });
    } catch (err) {
        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        } else {
            throw InvalidDocumentParameters("Provided document ID does not exist or new name is invalid.");
        }
    }
}

exports.loadByUser = async function load(user_id) {
    try {
        return await Document.findAll({
            where: {
                userId: user_id, deleted: false
            }
        });
    } catch (err) {
        if (isInternalDatabaseError(err)) {
            throw InternalDatabaseError(err);
        } else {
            throw InvalidDocumentParameters("Provided user ID is invalid. Cannot find associated documents.");
        }
    }
}