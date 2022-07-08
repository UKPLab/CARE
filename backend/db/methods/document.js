const {v4: uuidv4} = require("uuid");

const { DataTypes, Op } = require("sequelize")
const db = require("../models/index.js")
const Document = require("../models/document.js")(db.sequelize, DataTypes);

exports.add = async function add(doc_name, creator_id) {
    var hash;
    while(true){
        hash = uuidv4();

        const duplicates = await Document.count({
            where: {
                hash: hash
            }
        });

        if(duplicates === 0){
            break;
        }
    }

    return Document.create({
        name: doc_name,
        hash: hash,
        creator: creator_id,
    });
}

exports.deleteDoc = async function deleteDoc(doc_id) {
    return Document.update({deleted: true, deletedAt: new Date()}, {
        where: {
            id: doc_id
        }
    });
}

exports.rename = async function rename(doc_id, name) {
    return Document.update({name: name}, {
        where: {
            id: doc_id
        }
    });
}

exports.loadByUser = async function load(user_id) {
    return Document.findAll({
        where: {
            creator: user_id,
            deleted: false
        }
    })
}