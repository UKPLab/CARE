'use strict';
const MetaModel = require("../MetaModel.js");
const { QUEUE_STATUS } = require("../../utils/triggerQueueStatus.js");

module.exports = (sequelize, DataTypes) => {
    /**
     * Trigger queue / execution log model.
     * Records each run of a trigger rule (FIFO worker entries).
     */
    class TriggerQueue extends MetaModel {
        static autoTable = true;
        static STATUS = QUEUE_STATUS;

        static associate(models) {
            TriggerQueue.belongsTo(models["trigger"], { foreignKey: "triggerId", as: "trigger" });
            TriggerQueue.belongsTo(models["user"], { foreignKey: "userId", as: "user" });
        }
    }

    TriggerQueue.init({
        triggerId: DataTypes.INTEGER,
        status: DataTypes.INTEGER,
        userId: DataTypes.INTEGER,
        configuration: DataTypes.JSONB,
        errorMessage: DataTypes.TEXT,
        attemptCount: DataTypes.INTEGER,
        startedAt: DataTypes.DATE,
        completedAt: DataTypes.DATE,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'trigger_queue',
        tableName: 'trigger_queue',
    });

    return TriggerQueue;
};
