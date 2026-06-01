'use strict';
const MetaModel = require("../MetaModel.js");
const queueDashboard = require("../config/triggerQueueDashboard.js");

const { STATUS } = queueDashboard;

module.exports = (sequelize, DataTypes) => {
    /**
     * Trigger queue / execution log model.
     * Records each run of a trigger rule (FIFO worker entries).
     */
    class TriggerQueue extends MetaModel {
        static autoTable = true;
        static publicTable = true;
        static STATUS = STATUS;
        static dashboardConfiguration = queueDashboard;

        static associate(models) {
            TriggerQueue.belongsTo(models["trigger"], { foreignKey: "triggerId", as: "trigger" });
            TriggerQueue.belongsTo(models["user"], { foreignKey: "userId", as: "user" });
        }

        static async getAll(options = {}) {
            try {
                options.raw = true;
                return await this.findAll(options);
            } catch (err) {
                console.log(err);
            }
        }

        static async getByKey(key, id, options = {}) {
            if (!(key in this.getAttributes())) {
                console.log(`DB MetaModel Class ${key} not available: ${this.constructor.name}`);
                return;
            }
            try {
                return await this.findOne({
                    where: { [key]: id },
                    raw: true,
                    ...options,
                });
            } catch (err) {
                console.log(err);
            }
        }

        static async getById(id, options = {}) {
            return await this.getByKey("id", id, options);
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
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'trigger_queue',
        tableName: 'trigger_queue',
    });

    return TriggerQueue;
};
