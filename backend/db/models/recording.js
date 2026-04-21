"use strict";
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    class Recording extends MetaModel {
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
            status: DataTypes.STRING,
            startTime: DataTypes.DATE,
            endTime: DataTypes.DATE,
            userId: DataTypes.INTEGER,
            participantUserIds: DataTypes.JSONB,
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