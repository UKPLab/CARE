'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    /**
     * One immutable version of a criterion. Same group/version rules as `assessment`.
     * expertLevel keeps the configuration JSON integer (0 = beginner … 2 = expert in the existing data).
     * Points are unrestricted NUMERIC: PostgreSQL returns them as strings, convert with Number() where needed.
     */
    class Criterion extends MetaModel {
        static autoTable = false;
        static hasSoftDelete = false;

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
        function: DataTypes.STRING,
        subjective: DataTypes.BOOLEAN,
        expertLevel: DataTypes.INTEGER,
        createdAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: "criterion",
        tableName: "criterion",
        updatedAt: false,
    });

    return Criterion;
};
