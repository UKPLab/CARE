'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    /**
     * Places a criterion version at a position in a rubric version.
     */
    class RubricCriterion extends MetaModel {
        static autoTable = false;

        static associate(models) {
            RubricCriterion.belongsTo(models["rubric"], {foreignKey: "rubricId", as: "rubric"});
            RubricCriterion.belongsTo(models["criterion"], {foreignKey: "criterionId", as: "criterion"});
        }
    }

    RubricCriterion.init({
        rubricId: DataTypes.INTEGER,
        criterionId: DataTypes.INTEGER,
        criterionPositionInRubric: DataTypes.INTEGER,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: "rubric_criterion",
        tableName: "rubric_criterion",
    });

    return RubricCriterion;
};
