'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    /**
     * Places a criterion version at a position in a rubric version. The row id is the
     * "criterion occurrence id" under which assessment results are stored.
     * A criterion version can appear once per rubric version and can be reused across rubric versions.
     */
    class RubricCriterion extends MetaModel {
        static autoTable = false;
        static hasSoftDelete = false;

        static associate(models) {
            RubricCriterion.belongsTo(models["rubric"], {foreignKey: "rubricId", as: "rubric"});
            RubricCriterion.belongsTo(models["criterion"], {foreignKey: "criterionId", as: "criterion"});
        }
    }

    RubricCriterion.init({
        rubricId: DataTypes.INTEGER,
        criterionId: DataTypes.INTEGER,
        criterionPositionInRubric: DataTypes.INTEGER,
    }, {
        sequelize,
        modelName: "rubric_criterion",
        tableName: "rubric_criterion",
        timestamps: false,
    });

    return RubricCriterion;
};
