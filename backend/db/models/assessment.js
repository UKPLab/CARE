'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    /**
     * One immutable version of an assessment; versions of the same assessment share `assessmentGroupId`.
     */
    class Assessment extends MetaModel {
        static autoTable = false;

        static associate(models) {
            Assessment.hasMany(models["assessment_rubric"], {foreignKey: "assessmentId", as: "assessmentRubrics"});
            Assessment.belongsTo(models["assessment"], {foreignKey: "previousAssessmentVersionId", as: "previousVersion"});
        }
    }

    Assessment.init({
        assessmentGroupId: {
            type: DataTypes.INTEGER,
            defaultValue: sequelize.literal(`nextval('"assessment_group_id_seq"')`),
        },
        versionNumber: DataTypes.STRING,
        name: DataTypes.STRING,
        description: DataTypes.TEXT,
        previousAssessmentVersionId: DataTypes.INTEGER,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: "assessment",
        tableName: "assessment",
    });

    return Assessment;
};
