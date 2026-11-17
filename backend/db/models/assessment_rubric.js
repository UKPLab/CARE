'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    /**
     * Places a rubric version at a position in an assessment version.
     */
    class AssessmentRubric extends MetaModel {
        static autoTable = false;

        static associate(models) {
            AssessmentRubric.belongsTo(models["assessment"], {foreignKey: "assessmentId", as: "assessment"});
            AssessmentRubric.belongsTo(models["rubric"], {foreignKey: "rubricId", as: "rubric"});
        }
    }

    AssessmentRubric.init({
        assessmentId: DataTypes.INTEGER,
        rubricId: DataTypes.INTEGER,
        rubricPositionInAssessment: DataTypes.INTEGER,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: "assessment_rubric",
        tableName: "assessment_rubric",
    });

    return AssessmentRubric;
};
