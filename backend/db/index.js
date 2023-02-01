/* Entry Point for sequelize models

Declare all necessary dependencies to work with the database models

Author: Nils Dycke, Dennis Zyska
*/
'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const {DataTypes, Model} = require("sequelize");
const yaml = require("js-yaml");
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/config/config.js')[env];
const db = {};

let sequelize;
if (config.use_env_variable) {
    sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
    sequelize = new Sequelize(config.database, config.username, config.password, config);
}

/*
fs
    .readdirSync(__dirname)
    .filter(file => {
        return (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js');
    })
    .forEach(file => {
        const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
        db[model.name] = model;
    });
*/

db.sequelize = sequelize;
db.Sequelize = Sequelize;

// Import models
db.models = {}
const models = fs.readdirSync(path.resolve(__dirname, "./models"))
    .filter(file => file.endsWith(".js"))
    .map((file) => {
        return require(path.resolve(__dirname, "./models") + "/" + file)
    })

models.forEach(dbModel => {
    const loadModel = dbModel(db.sequelize, DataTypes);
    db.models[loadModel.name] = loadModel;
})

Object.keys(db.models).forEach(modelName => {
    if (db.models[modelName].associate) {
        db.models[modelName].associate(db);
    }
});

module.exports = db;