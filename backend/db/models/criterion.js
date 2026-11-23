'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    /**
     * One immutable version of a criterion; versions of the same criterion share `criterionGroupId`.
     * `settings` holds free key/value pairs; NULL bounds mean the bound is not active.
     */
    class Criterion extends MetaModel {
        static autoTable = false;

        static associate(models) {
            Criterion.hasMany(models["rubric_criterion"], {foreignKey: "criterionId", as: "rubricCriteria"});
            Criterion.hasMany(models["criterion_scoring_option"], {foreignKey: "criterionId", as: "scoringOptions"});
        }
    }

    Criterion.init({
        criterionGroupId: {
            type: DataTypes.INTEGER,
            defaultValue: sequelize.literal(`nextval('"criterion_group_id_seq"')`),
        },
        versionNumber: DataTypes.STRING,
        name: DataTypes.STRING,
        description: DataTypes.TEXT,
        minPoints: DataTypes.DECIMAL,
        maxPoints: DataTypes.DECIMAL,
        settings: DataTypes.JSONB,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: "criterion",
        tableName: "criterion",
    });

    return Criterion;
};
