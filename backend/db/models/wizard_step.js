'use strict';

const MetaModel = require('../MetaModel.js');

module.exports = (sequelize, DataTypes) => {
    class WizardStep extends MetaModel {
        static autoTable = false;

        static associate(models) {
            WizardStep.hasMany(models["setting"], {
                foreignKey: "wizardStepId",
                as: "settings",
            });
            WizardStep.belongsTo(models["wizard_step_type"], {
                foreignKey: "wizardStepTypeId",
                as: "wizardStepType",
            });
        }
    }

    WizardStep.init(
        {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: DataTypes.INTEGER,
            },
            key: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
            },
            order: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            title: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            description: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            wizardStepTypeId: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            deleted: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
            },
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
            deletedAt: DataTypes.DATE,
        },
        {
            sequelize,
            modelName: 'wizard_step',
            tableName: 'wizard_step',
        }
    );

    return WizardStep;
};
