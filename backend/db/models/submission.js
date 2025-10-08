"use strict";
const MetaModel = require("../MetaModel.js");
const {Op} = require("sequelize");

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
        }

        /**
         * Filter and return existing extIds from a given list
         * @param {number[]} extIds a list of external ids to check
         * @returns {Promise<array>} a list of extIds
         */
        static async filterExistingExtIds(extIds) {
            return await Submission.findAll({
                where: {
                    extId: { [Op.in]: extIds },
                    deleted: false,
                },
                attributes: ["extId"],
                raw: true,
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
            validationConfigurationId: DataTypes.INTEGER,
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
