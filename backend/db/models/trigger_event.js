'use strict';
const MetaModel = require("../MetaModel.js");
const { assertTriggerAdminWrite } = require("../../utils/helper/trigger/adminWrite.js");

module.exports = (sequelize, DataTypes) => {
    /**
     * Trigger event catalog model.
     * Global, admin-managed list of events that a trigger can react to.
     */
    class TriggerEvent extends MetaModel {
        static autoTable = true;
        static publicTable = true;

        static associate(models) {
        }
    }

    TriggerEvent.init({
        name: DataTypes.STRING,
        enabled: DataTypes.BOOLEAN,
        configuration: DataTypes.JSONB,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'trigger_event',
        tableName: 'trigger_event',
        hooks: {
            beforeCreate: async (_row, options) => {
                await assertTriggerAdminWrite(sequelize, options);
            },
            beforeUpdate: async (_row, options) => {
                await assertTriggerAdminWrite(sequelize, options);
            },
        },
    });

    return TriggerEvent;
};
