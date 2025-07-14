'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    /**
     * AnnotationState model
     * Stores state information for annotations, linked to user_environment style.
     */
    class AnnotationState extends MetaModel {
        static autoTable = true;
        static associate(models) {
        }
    }

    AnnotationState.init({
        documentId: DataTypes.INTEGER,
        userId: DataTypes.INTEGER,
        studySessionId: DataTypes.INTEGER,
        studyStepId: DataTypes.INTEGER,
        commentId: DataTypes.INTEGER,
        state: DataTypes.INTEGER,
        updatedAt: DataTypes.DATE,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE
    }, {
        sequelize: sequelize,
        modelName: 'annotation_state',
        tableName: 'annotation_state'
    });
    return AnnotationState;
};