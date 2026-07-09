'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    /**
     * Trigger queue / execution log model.
     * Records each run of a trigger rule (FIFO worker entries).
     */
    class TriggerQueue extends MetaModel {
        static autoTable = true;
        static STATUS = {
            PENDING: 0,
            RUNNING: 1,
            COMPLETED: 2,
            CANCELLED: 3,
            FAILED: 4,
        };

        static sanitizeOptions(options = {}) {
            const nextOptions = { ...options };
            if (nextOptions.where && "deleted" in nextOptions.where) {
                nextOptions.where = { ...nextOptions.where };
                delete nextOptions.where.deleted;
            }
            return nextOptions;
        }

        static associate(models) {
            TriggerQueue.belongsTo(models["trigger"], { foreignKey: "triggerId", as: "trigger" });
            TriggerQueue.belongsTo(models["user"], { foreignKey: "userId", as: "user" });
        }

        static async getAll(options = {}) {
            try {
                const nextOptions = this.sanitizeOptions(options);
                nextOptions.raw = true;
                return await this.findAll(nextOptions);
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
