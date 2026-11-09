'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    /**
     * One selectable score level of a criterion version. Points may be negative.
     * Points are unrestricted NUMERIC: PostgreSQL returns them as strings, convert with Number() where needed.
     */
    class CriterionScoringOption extends MetaModel {
        static autoTable = false;
        static hasSoftDelete = false;

        static associate(models) {
            CriterionScoringOption.belongsTo(models["criterion"], {foreignKey: "criterionId", as: "criterion"});
        }
    }

    CriterionScoringOption.init({
        criterionId: DataTypes.INTEGER,
        points: DataTypes.DECIMAL,
        description: DataTypes.TEXT,
        position: DataTypes.INTEGER,
    }, {
        sequelize,
        modelName: "criterion_scoring_option",
        tableName: "criterion_scoring_option",
        timestamps: false,
    });

    return CriterionScoringOption;
};
