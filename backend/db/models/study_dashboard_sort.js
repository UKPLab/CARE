"use strict";

const {Model} = require("sequelize");

/**
 * Read-only mapping of materialized view study_dashboard_sort.
 * Not an autoTable — JOIN target for queryTable sort / filter / search on state and sessions.
 */
module.exports = (sequelize, DataTypes) => {
    class StudyDashboardSort extends Model {
        static autoTable = false;
    }

    StudyDashboardSort.init({
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
        },
        state: {
            type: DataTypes.STRING,
        },
        stateRank: {
            type: DataTypes.INTEGER,
        },
        sessions: {
            type: DataTypes.INTEGER,
        },
    }, {
        sequelize,
        modelName: "study_dashboard_sort",
        tableName: "study_dashboard_sort",
        timestamps: false,
        underscored: false,
    });

    return StudyDashboardSort;
};
