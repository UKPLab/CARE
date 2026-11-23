'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    /**
     * One selectable score level of a criterion version, ordered by `position`.
     */
    class CriterionScoringOption extends MetaModel {
        static autoTable = false;

        static associate(models) {
            CriterionScoringOption.belongsTo(models["criterion"], {foreignKey: "criterionId", as: "criterion"});
        }
    }

    CriterionScoringOption.init({
        criterionId: DataTypes.INTEGER,
        points: DataTypes.DECIMAL,
        description: DataTypes.TEXT,
        position: DataTypes.INTEGER,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: "criterion_scoring_option",
        tableName: "criterion_scoring_option",
    });

    return CriterionScoringOption;
};
