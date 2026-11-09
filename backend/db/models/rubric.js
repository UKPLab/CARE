'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    /**
     * One immutable version of a rubric. Same group/version rules as `assessment`.
     * Points are unrestricted NUMERIC: PostgreSQL returns them as strings, convert with Number() where needed.
     * calculation: "sum" | "min" | "max" (see utils/modules/assessment-score).
     */
    class Rubric extends MetaModel {
        static autoTable = false;
        static hasSoftDelete = false;

        static associate(models) {
            Rubric.hasMany(models["assessment_rubric"], {foreignKey: "rubricId", as: "assessmentRubrics"});
            Rubric.hasMany(models["rubric_criterion"], {foreignKey: "rubricId", as: "rubricCriteria"});
        }
    }

    Rubric.init({
        rubricGroupId: {
            type: DataTypes.INTEGER,
            defaultValue: sequelize.literal(`nextval('"rubric_group_id_seq"')`),
        },
        versionNumber: DataTypes.STRING,
        name: DataTypes.STRING,
        description: DataTypes.TEXT,
        minPoints: DataTypes.DECIMAL,
        maxPoints: DataTypes.DECIMAL,
        calculation: DataTypes.STRING,
        defaultPoints: DataTypes.DECIMAL,
        isBonus: DataTypes.BOOLEAN,
        createdAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: "rubric",
        tableName: "rubric",
        updatedAt: false,
    });

    return Rubric;
};
