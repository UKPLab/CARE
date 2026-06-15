"use strict";
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    // Allowed recording lifecycle states. Single source of truth for the
    // status validator below; add new states here (e.g. when disconnected
    // flagging lands) rather than scattering string literals.
    const RECORDING_STATUSES = ["recording", "finished", "replaying", "disconnected"];

    class Recording extends MetaModel {
        // MetaModel flags. autoTable registers this model for generic CRUD
        // over sockets. fields=[] means no column whitelist (all columns
        // returned). publicTable=true routes reads through getAll() with no
        // per-user access filtering, so any subscriber can read all rows.
        static autoTable = true;
        static fields = [];
        static publicTable = true;
        
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
            participantUserIds: DataTypes.JSONB,
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