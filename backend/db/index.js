/**
 * Declare all necessary dependencies to work with the database models
 *
 * @author Nils Dycke, Dennis Zyska, Junaid Feroz
 */

'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const {DataTypes} = require("sequelize");
const env = process.env.NODE_ENV || 'development';
const loadedConfig = require(__dirname + '/config/config.js')[env];
const {GlobalChangeTrackingPlugin, TimeoutTrackerPlugin} = require('./plugins');
const db = {};
// add in global hook for tracking timed out transactions
const config = {
  ...loadedConfig,
  hooks: {
    ...(loadedConfig.hooks || {}), // Preserve existing hooks if we should ever add any in the config
    afterConnect: async (connection) => {
      if (loadedConfig.hooks && typeof loadedConfig.hooks.afterConnect === "function") {
        await loadedConfig.hooks.afterConnect(connection);
      }
      const encryptionKey = process.env.DB_ENCRYPTION_KEY;
      if (!encryptionKey) {
        throw new Error('DB_ENCRYPTION_KEY must be set before establishing database connections');
      }
      const escapedKey = encryptionKey.replace(/'/g, "''");
      await connection.query(`SET app.encryption_key = '${escapedKey}'`);
    },
    afterInit: TimeoutTrackerPlugin,
  }
};
let sequelize;
if (config.use_env_variable) {
    sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
    sequelize = new Sequelize(config.database, config.username, config.password, config);
}

// Add global change tracking hooks to all models
GlobalChangeTrackingPlugin(sequelize);

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
        db.models[modelName].associate(db.models);
    }
});



module.exports = db;