"use strict";
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    class Trace extends MetaModel {
        // MetaModel flags. autoTable registers this model for generic CRUD
        // over sockets. fields=[] means no column whitelist. publicTable=false
        // keeps traces out of the generic subscription layer, since payloads
        // can hold sensitive event data — they're fetched explicitly instead.
        static autoTable = true;
        static fields = [];
        static publicTable = false;

        static associate(models) {
            Trace.belongsTo(models["recording"], {
                foreignKey: "recordingId",
                as: "recording",
            });
            Trace.belongsTo(models["user"], {
                foreignKey: "userId",
                as: "user",
            });
        }
    }

    Trace.init(
        {
            recordingId: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            userId: DataTypes.INTEGER,
            socketId: DataTypes.STRING,
            action: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            payload: DataTypes.JSONB,
            direction: {
                type: DataTypes.BOOLEAN, // true = frontend -> backend, false = backend -> frontend
                allowNull: false,
            },
            startTime: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            endTime: DataTypes.DATE,
            deleted: DataTypes.BOOLEAN,
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