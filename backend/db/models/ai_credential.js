'use strict';

/**
 * Sequelize model for per-user LLM provider credentials and orchestration state.
 * Cascades soft-delete/disable to dependent models via discovered foreign keys.
 *
 * @author Akash Gundapuneni
 */
const MetaModel = require('../MetaModel.js');

module.exports = (sequelize, DataTypes) => {
    class AiCredential extends MetaModel {
        static autoTable = true;

        /**
         * Loads an enabled, non-deleted credential owned by the given user, or throws.
         *
         * @param {number} id Target `ai_credential` primary key.
         * @param {number} userId Caller's user id (ownership check).
         * @returns {Promise<Object>} The credential row.
         * @throws {Error} If missing, deleted, not owned by the caller, or disabled.
         */
        static async getOwnedById(id, userId) {
            const credential = await AiCredential.getById(id, {
                attributes: ["id", "userId", "provider", "apiKey", "apiBaseUrl", "apiVersion", "enabled", "deleted"],
            });
            if (!credential || credential.deleted) {
                throw new Error("Credential not found");
            }
            if (!userId || credential.userId !== userId) {
                throw new Error("You are not allowed to access this credential");
            }
            if (!credential.enabled) {
                throw new Error("Credential is disabled");
            }
            return credential;
        }

        /**
         * Soft-delete: recurse into models whose FK follows Sequelize's class convention
         * (`AiCredential` → `aiCredentialId`) and expose `deleted`, then deeper dependents
         * (e.g. `AiModel` → `aiModelId`).
         * Disable credential: set `enabled: false` on non-deleted dependents that have `enabled`.
         * Bulk updates skip instance hooks; append affected `autoTable` rows to `transaction.changes`.
         */
        static #fkColumnReferencingParent(ParentModel) {
            const n = ParentModel.options?.name?.singular || ParentModel.name;
            const stem = n.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
            return stem + "Id";
        }

        static #modelsDeclaringFkTo(ParentModel) {
            const fk = AiCredential.#fkColumnReferencingParent(ParentModel);
            return Object.values(sequelize.models).filter(
                (m) =>
                    m?.rawAttributes &&
                    Object.prototype.hasOwnProperty.call(m.rawAttributes, fk),
            );
        }

        static #appendInstancesToTransactionChanges(transaction, instances) {
            if (!transaction || !instances?.length) {
                return;
            }
            transaction.changes = transaction.changes || [];
            for (const inst of instances) {
                transaction.changes.push(inst);
            }
        }

        static async #cascadeSoftDeleteDependents(ParentModel, parentIds, transaction) {
            if (!transaction || !parentIds?.length) {
                return [];
            }
            const fk = AiCredential.#fkColumnReferencingParent(ParentModel);
            const childModels = AiCredential.#modelsDeclaringFkTo(ParentModel).filter((m) =>
                Object.prototype.hasOwnProperty.call(m.rawAttributes, "deleted"),
            );

            let collected = [];
            for (const Child of childModels) {
                const childPk = Child.primaryKeyAttribute || "id";
                const rows = await Child.findAll({
                    attributes: [childPk],
                    where: {[fk]: parentIds, deleted: false},
                    raw: true,
                    transaction,
                });
                const childIds = rows
                    .map((row) => row[childPk])
                    .filter((mid) => Number.isInteger(mid) && mid > 0);
                if (childIds.length === 0) {
                    continue;
                }

                await Child.update(
                    {deleted: true, deletedAt: new Date()},
                    {where: {[fk]: parentIds, deleted: false}, transaction},
                );

                const instances = await Child.findAll({
                    where: {[childPk]: childIds},
                    transaction,
                });
                collected.push(...instances);

                const nested = await AiCredential.#cascadeSoftDeleteDependents(Child, childIds, transaction);
                collected.push(...nested);
            }
            return collected;
        }

        static async #cascadeModelsAfterCredentialWrite(credentialId, data, transaction) {
            const id = Number(credentialId);
            if (!Number.isInteger(id) || id <= 0) {
                return;
            }

            if (data.deleted) {
                const instances = await AiCredential.#cascadeSoftDeleteDependents(AiCredential, [id], transaction);
                const autoTableInstances = instances.filter((inst) => inst.constructor.autoTable);
                AiCredential.#appendInstancesToTransactionChanges(transaction, autoTableInstances);
                return;
            }

            if (Object.prototype.hasOwnProperty.call(data, "enabled") && data.enabled === false) {
                const fk = AiCredential.#fkColumnReferencingParent(AiCredential);
                const childModels = AiCredential.#modelsDeclaringFkTo(AiCredential).filter(
                    (m) =>
                        Object.prototype.hasOwnProperty.call(m.rawAttributes, "enabled") &&
                        Object.prototype.hasOwnProperty.call(m.rawAttributes, "deleted"),
                );
                let instances = [];
                for (const Child of childModels) {
                    await Child.update(
                        {enabled: false},
                        {where: {[fk]: id, deleted: false}, transaction},
                    );
                    const disabled = await Child.findAll({
                        where: {[fk]: id, deleted: false},
                        transaction,
                    });
                    instances.push(...disabled);
                }
                AiCredential.#appendInstancesToTransactionChanges(
                    transaction,
                    instances.filter((inst) => inst.constructor.autoTable),
                );
            }
        }

        /**
         * Persists credential mutations then cascades dependent model enables/deletes atomically when needed.
         *
         * @param {number|string} id Primary key.
         * @param {object} data Partial Sequelize payload (e.g. `deleted`, `enabled`).
         * @param {{ transaction?: object }} [additionalOptions] Optional caller-provided Sequelize transaction hooks.
         * @returns {Promise<*>}
         */
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
            } catch (error) {
                await transaction.rollback();
                throw error;
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
