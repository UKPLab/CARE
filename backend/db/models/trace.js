"use strict";
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    class Trace extends MetaModel {
        static autoTable = true;
        static fields = [];
        static publicTable = true;

        static associate(models) {
            Trace.belongsTo(models["recording"], {
                foreignKey: "recordingId",
                as: "recording",
            });
        }
    }

    Trace.init(
        {
            recordingId: DataTypes.INTEGER,
            action: DataTypes.STRING,
            payload: DataTypes.JSONB,
            direction: DataTypes.BOOLEAN,
            startTime: DataTypes.DATE,
            endTime: DataTypes.DATE,
            deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
            deletedAt: DataTypes.DATE,
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
        },
        {
            sequelize,
            modelName: "trace",
            tableName: "trace",
        }
    );

    return Trace;
};