'use strict';

const MetaModel = require('../MetaModel.js');

module.exports = (sequelize, DataTypes) => {
    class WizardStepType extends MetaModel {
        static autoTable = false;

        static associate(models) {
            WizardStepType.hasMany(models["wizard_step"], {
                foreignKey: "wizardStepTypeId",
                as: "wizardSteps",
            });
        }
    }

    WizardStepType.init(
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
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
        },
        {
            sequelize,
            modelName: "wizard_step_type",
            tableName: "wizard_step_type",
        }
    );

    return WizardStepType;
};
