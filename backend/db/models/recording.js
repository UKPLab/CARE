"use strict";
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    // Allowed recording lifecycle states. Single source of truth for the
    // status validator below; add new states here rather than scattering
    // string literals. "interrupted" is set on startup for recordings whose
    // server died mid-capture.
    const RECORDING_STATUSES = ["recording", "finished", "disconnected", "interrupted"];

    class Recording extends MetaModel {
        // MetaModel flags. autoTable registers this model for generic CRUD
        // over sockets. fields=[] means no column whitelist (all columns
        // returned). publicTable=false keeps recordings out of unauthenticated
        // reads: they are admin-only artifacts, and the rows expose who was
        // recorded, their session ids and their activity times.
        static autoTable = true;
        static fields = [];
        static publicTable = false;
        
        static associate(models) {
            Recording.belongsTo(models["user"], {
                foreignKey: "userId",
                as: "user",
            });
            Recording.hasMany(models["trace"], {
                foreignKey: "recordingId",
                as: "traces",
            });
        }
    }

    Recording.init(
        {
            name: DataTypes.STRING,
            status: {
                type: DataTypes.STRING,
                allowNull: false,
                validate: { isIn: [RECORDING_STATUSES] },
            },
            startTime: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            endTime: DataTypes.DATE,
            userId: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            participantSocketIds: DataTypes.JSONB,
            excludeEvents: DataTypes.JSONB,
            deleted: DataTypes.BOOLEAN,
            deletedAt: DataTypes.DATE,
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
        },
        {
            sequelize,
            modelName: "recording",
            tableName: "recording",
        }
    );

    return Recording;
};