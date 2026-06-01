'use strict';
const MetaModel = require("../MetaModel.js");
const rulesDashboard = require("../config/triggerRulesDashboard.js");

module.exports = (sequelize, DataTypes) => {
    /**
     * Trigger rule model.
     * Links an event to an action (with optional project scope) and holds
     * execution settings (retries, parallel limit, timeout) plus a JSONB
     * `configuration` carrying the action's collected data.
     */
    class Trigger extends MetaModel {
        static autoTable = true;
        static dashboardConfiguration = rulesDashboard;

        static associate(models) {
            Trigger.belongsTo(models["user"], { foreignKey: "userId", as: "user" });
            Trigger.belongsTo(models["trigger_event"], { foreignKey: "triggerEventId", as: "event" });
            Trigger.belongsTo(models["trigger_action"], { foreignKey: "triggerActionId", as: "action" });
            Trigger.belongsTo(models["project"], { foreignKey: "projectId", as: "project" });
        }
    }

    Trigger.init({
        name: DataTypes.STRING,
        userId: DataTypes.INTEGER,
        triggerEventId: DataTypes.INTEGER,
        triggerActionId: DataTypes.INTEGER,
        projectId: DataTypes.INTEGER,
        scheduledAt: DataTypes.DATE,
        parallelLimit: DataTypes.INTEGER,
        maxRetries: DataTypes.INTEGER,
        enabled: DataTypes.BOOLEAN,
        timeout: DataTypes.INTEGER,
        configuration: DataTypes.JSONB,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'trigger',
        tableName: 'trigger',
    });

    return Trigger;
};
