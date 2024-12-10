'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    class Collab extends MetaModel {
        static autoTable = true;

        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here
            
            Collab.belongsTo(models["study_step"], {
                foreignKey: 'studyStepId',
                as: 'studyStep',
            });
        }
    }

    Collab.init({
        collabHash: DataTypes.STRING,
        userId: DataTypes.INTEGER,
        documentId: DataTypes.INTEGER,
        studySessionId: DataTypes.INTEGER,
        studyStepId: DataTypes.INTEGER,
        targetType: DataTypes.STRING,
        targetId: DataTypes.INTEGER,
        timestamp: DataTypes.DATE,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
    }, {
        sequelize,
        modelName: 'collab',
        tableName: 'collab'
    });
    return Collab;
};