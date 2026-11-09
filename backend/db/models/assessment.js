'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    /**
     * One immutable version of an assessment. Versions of the same logical assessment share
     * assessmentGroupId: omit it to start a new group (the database draws the next id from a
     * sequence), pass an existing one to add a version to that group.
     */
    class Assessment extends MetaModel {
        static autoTable = false;
        static hasSoftDelete = false;

        static associate(models) {
            Assessment.hasMany(models["assessment_rubric"], {foreignKey: "assessmentId", as: "assessmentRubrics"});
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
        createdAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: "assessment",
        tableName: "assessment",
        updatedAt: false,
    });

    return Assessment;
};
