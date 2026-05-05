'use strict';
const MetaModel = require('../MetaModel.js');

module.exports = (sequelize, DataTypes) => {
    class AiCredential extends MetaModel {
        static autoTable = true;

        /**
         * When a credential is soft-deleted, soft-delete dependent ai_model rows (and their shares).
         * When a credential is disabled, disable dependent ai_model rows (non-deleted only).
         */
        /**
         * Bulk updates do not populate Sequelize instance hooks, so they are missing from
         * `transaction.changes` and clients never receive `ai_modelRefresh`. Append instances here.
         */
        static #appendInstancesToTransactionChanges(transaction, instances) {
            if (!transaction || !instances?.length) {
                return;
            }
            transaction.changes = transaction.changes || [];
            for (const inst of instances) {
                transaction.changes.push(inst);
            }
        }

        static async #cascadeModelsAfterCredentialWrite(credentialId, data, transaction) {
            const id = Number(credentialId);
            if (!Number.isInteger(id) || id <= 0) {
                return;
            }
            const AiModel = sequelize.models.ai_model;
            const AiModelShare = sequelize.models.ai_model_share;
            if (!AiModel) {
                return;
            }

            if (data.deleted) {
                const rows = await AiModel.findAll({
                    attributes: ["id"],
                    where: {aiCredentialId: id, deleted: false},
                    raw: true,
                    transaction,
                });
                const modelIds = rows.map((row) => row.id).filter((mid) => Number.isInteger(mid) && mid > 0);

                await AiModel.update(
                    {deleted: true, deletedAt: new Date()},
                    {where: {aiCredentialId: id, deleted: false}, transaction},
                );

                if (modelIds.length > 0 && AiModelShare) {
                    await AiModelShare.update(
                        {deleted: true, deletedAt: new Date()},
                        {where: {aiModelId: modelIds, deleted: false}, transaction},
                    );
                }

                if (modelIds.length > 0) {
                    const modelInstances = await AiModel.findAll({
                        where: {id: modelIds},
                        transaction,
                    });
                    AiCredential.#appendInstancesToTransactionChanges(transaction, modelInstances);
                }
                return;
            }

            if (Object.prototype.hasOwnProperty.call(data, "enabled") && data.enabled === false) {
                await AiModel.update(
                    {enabled: false},
                    {where: {aiCredentialId: id, deleted: false}, transaction},
                );
                const disabledModelInstances = await AiModel.findAll({
                    where: {aiCredentialId: id, deleted: false},
                    transaction,
                });
                AiCredential.#appendInstancesToTransactionChanges(transaction, disabledModelInstances);
            }
        }

        static async updateById(id, data, additionalOptions = {}) {
            const existingTx = additionalOptions.transaction;

            const run = async (transaction) => {
                const opts = {...additionalOptions, transaction};
                const result = await super.updateById(id, data, opts);
                await AiCredential.#cascadeModelsAfterCredentialWrite(id, data, transaction);
                return result;
            };

            if (existingTx) {
                return run(existingTx);
            }

            const transaction = await sequelize.transaction();
            try {
                const result = await run(transaction);
                await transaction.commit();
                return result;
            } catch (err) {
                await transaction.rollback();
                throw err;
            }
        }
    }

    AiCredential.init({
        userId: DataTypes.INTEGER,
        name: DataTypes.STRING,
        apiKey: DataTypes.TEXT,
        provider: DataTypes.STRING,
        apiBaseUrl: DataTypes.STRING,
        apiVersion: DataTypes.STRING,
        enabled: DataTypes.BOOLEAN,
        additionalParameters: DataTypes.JSONB,
        deleted: DataTypes.BOOLEAN,
        deletedAt: DataTypes.DATE,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'ai_credential',
        tableName: 'ai_credential',
    });

    return AiCredential;
};
