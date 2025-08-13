"use strict";
const MetaModel = require("../MetaModel.js");

module.exports = (sequelize, DataTypes) => {
    class Submission extends MetaModel {
        static autoTable = true;

        static fields = [];

        static associate(models) {
            Submission.hasMany(models["document"], {
                foreignKey: "submissionId",
                as: "documents",
            });

            Submission.belongsTo(models["submission"], {
                foreignKey: "parentSubmissionId",
                as: "parentSubmission",
            });

            Submission.belongsTo(models["document"], {
                foreignKey: "validationDocumentId",
                as: "validationDocument",
            });
        }
    }

    Submission.init(
        {
            userId: DataTypes.INTEGER,
            createdByUserId: DataTypes.INTEGER,
            projectId: DataTypes.INTEGER,
            parentSubmissionId: DataTypes.INTEGER,
            extId: DataTypes.INTEGER,
            group: DataTypes.INTEGER,
            additionalSettings: DataTypes.JSONB,
            validationDocumentId: DataTypes.INTEGER,
            deleted: DataTypes.BOOLEAN,
            deletedAt: DataTypes.DATE,
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
        },
        {
            sequelize,
            modelName: "submission",
            tableName: "submission",
        }
    );

    return Submission;
};
