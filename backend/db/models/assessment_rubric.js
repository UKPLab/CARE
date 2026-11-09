'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    /**
     * Places a rubric version at a position in an assessment version.
     * A rubric version can appear once per assessment version and can be reused across assessment versions.
     */
    class AssessmentRubric extends MetaModel {
        static autoTable = false;
        static hasSoftDelete = false;

        static associate(models) {
            AssessmentRubric.belongsTo(models["assessment"], {foreignKey: "assessmentId", as: "assessment"});
            AssessmentRubric.belongsTo(models["rubric"], {foreignKey: "rubricId", as: "rubric"});
        }
    }

    AssessmentRubric.init({
        assessmentId: DataTypes.INTEGER,
        rubricId: DataTypes.INTEGER,
        rubricPositionInAssessment: DataTypes.INTEGER,
    }, {
        sequelize,
        modelName: "assessment_rubric",
        tableName: "assessment_rubric",
        timestamps: false,
    });

    return AssessmentRubric;
};
