'use strict';
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    /**
     * Trigger action catalog model.
     * Global, admin-managed list of actions a trigger can run. Each row's
     * `configuration` carries the action's form schema and runtime metadata.
     */
    class TriggerAction extends MetaModel {
        static autoTable = true;
        static publicTable = true;

        static associate(models) {
        }
    }

    TriggerAction.init({
        name: DataTypes.STRING,
        enabled: DataTypes.BOOLEAN,
        configuration: DataTypes.JSONB,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'trigger_action',
        tableName: 'trigger_action',
    });

    return TriggerAction;
};
