"use strict";

/**
 * Handlers backing AI model-sharing flows (ownership checks, hydrate UI selectors, transactional writes).
 *
 * @module webserver/services/ai/share
 * @author Akash Gundapuneni
 */

const {Op} = require("sequelize");
const helpers = require("./helpers");
const budget = require("./budget");

const DEFAULT_SHARE_MODE = "users";

/**
 * Validates that `ownerUserId` controls the undeleted AI model optionally inside a Sequelize transaction.
 *
 * @param {{ db: Object }} server Server DB registry.
 * @param {number} ownerUserId Model owner asserting admin rights over shares.
 * @param {number} aiModelId Target `ai_model` primary key from RPC payload.
 * @param {import("sequelize").Transaction} [transaction] Optional Sequelize transaction scope.
 * @returns {Promise<object>} Plain ORM snapshot for downstream queries.
 */
async function assertModelOwnership(server, ownerUserId, aiModelId, transaction) {
    const normalizedModelId = Number(aiModelId);
    if (!Number.isInteger(normalizedModelId) || normalizedModelId <= 0) {
        throw new Error("Missing or invalid aiModelId");
    }
    const aiModel = await server.db.models.ai_model.findOne({
        where: {id: normalizedModelId, deleted: false},
        raw: true,
        transaction,
    });
    if (!aiModel) {
        throw new Error("AI model not found");
    }
    if (Number(aiModel.userId) !== Number(ownerUserId)) {
        throw new Error("You can only manage shares for models that you own");
    }
    return aiModel;
}

/**
 * Lightweight fetch for dashboards where ownership is verified separately afterward.
 *
 * @param {{ db: Object }} server Server accessor.
 * @param {number} aiModelId Target PK.
 * @returns {Promise<object>} Active model row keyed by Sequelize attributes.
 */
async function loadAiModelRow(server, aiModelId) {
    const id = Number(aiModelId);
    if (!Number.isInteger(id) || id <= 0) {
        throw new Error("Missing or invalid aiModelId");
    }
    const row = await server.db.models.ai_model.findOne({
        where: {id, deleted: false},
        raw: true,
    });
    if (!row) {
        throw new Error("AI model not found");
    }
    return row;
}

/**
 * Returns the enabled target handler for a request mode, defaulting to direct users.
 *
 * @param {string} mode Incoming share mode.
 * @returns {object}
 */
function getShareTarget(mode) {
    return SHARE_TARGETS[mode] || SHARE_TARGETS[DEFAULT_SHARE_MODE];
}

/**
 * Verifies that all selected ids exist on a soft-delete aware table.
 *
 * @param {import("sequelize").Model} model Sequelize model to query.
 * @param {number[]} ids Requested primary keys.
 * @param {string} errorMessage Error raised when any requested id is invalid.
 * @param {import("sequelize").Transaction} transaction Optional transaction scope.
 */
async function assertActiveIds(model, ids, errorMessage, transaction) {
    const rows = await model.findAll({
        where: {id: ids, deleted: false},
        attributes: ["id"],
        raw: true,
        transaction,
    });
    const activeIds = new Set(rows.map((row) => Number(row.id)));
    if (ids.some((id) => !activeIds.has(id))) {
        throw new Error(errorMessage);
    }
}

/**
 * Normalizes positive selected ids from a share payload key.
 *
 * @param {object} data RPC payload.
 * @param {string} payloadKey Property containing selected ids.
 * @returns {number[]}
 */
function selectedPayloadIds(data, payloadKey) {
    return helpers.uniquePositiveInts(
        Array.isArray(data?.[payloadKey]) ? data[payloadKey] : [],
        (value) => Number(value),
    );
}

/**
 * Creates one `ai_model_share` row snapshot.
 *
 * @param {object} aiModel Target model.
 * @param {number} userId Recipient user id.
 * @param {Date} expiryDate Share expiry.
 * @param {object} [extra] Additional grant metadata.
 */
function createShareRow(aiModel, userId, expiryDate, extra = {}) {
    return {
        aiModelId: aiModel.id,
        userId,
        roleId: null,
        expiryDate,
        deleted: false,
        ...extra,
    };
}

/**
 * Extracts optional budget fields from a share payload and normalizes them to
 * numeric values or null. Reused by both users-mode and roles-mode createRows.
 *
 * @param {object} data RPC payload.
 * @returns {{costLimit: (number|null), notifyThreshold: (number|null)}}
 */
function extractBudgetFields(data) {
    const toNumberOrNull = (value) => {
        if (value === undefined || value === null || value === "") return null;
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : null;
    };
    return {
        costLimit: toNumberOrNull(data?.costLimit),
        notifyThreshold: toNumberOrNull(data?.notifyThreshold),
    };
}

const SHARE_TARGETS = {
    users: {
        mode: "users",
        payloadKey: "userIds",
        responseKey: "users",
        emptySelectionError: "Please select at least one user",
        invalidSelectionError: "One or more selected users are invalid",
        optionAttributes: ["id", "firstName", "lastName", "userName", "email"],
        optionOrder: [["firstName", "ASC"], ["lastName", "ASC"], ["userName", "ASC"]],
        getModel: (db) => db.user,
        getOptionWhere: (_db, ownerUserId) => ({deleted: false, id: {[Op.ne]: ownerUserId}}),
        mapOption: (user) => ({
            id: user.id,
            label: helpers.userDisplayLabel(user),
        }),
        getConfigIds: (shares) => helpers.uniquePositiveInts(shares.map((share) => share.userId)),
        createRows: async ({service, ownerUserId, aiModel, expiryDate, data, transaction, target}) => {
            const userIds = selectedPayloadIds(data, target.payloadKey)
                .filter((userId) => userId !== ownerUserId);
            if (userIds.length === 0) {
                throw new Error(target.emptySelectionError);
            }

            await assertActiveIds(
                target.getModel(service.server.db.models),
                userIds,
                target.invalidSelectionError,
                transaction,
            );

            const budgetFields = extractBudgetFields(data);
            return userIds.map((userId) => createShareRow(aiModel, userId, expiryDate, budgetFields));
        },
    },
    roles: {
        mode: "roles",
        payloadKey: "roleIds",
        responseKey: "roles",
        emptySelectionError: "Please select at least one role",
        invalidSelectionError: "One or more selected roles are invalid",
        emptyExpandedSelectionError: "No users found for selected role(s)",
        optionAttributes: ["id", "name"],
        optionOrder: [["name", "ASC"]],
        getModel: (db) => db.user_role,
        getOptionWhere: () => ({deleted: false}),
        mapOption: (role) => ({
            id: role.id,
            label: role.name || `Role ${role.id}`,
        }),
        getConfigIds: (shares) => helpers.uniquePositiveInts(shares.map((share) => share.roleId)),
        createRows: async ({service, ownerUserId, aiModel, expiryDate, data, transaction, target}) => {
            const roleIds = selectedPayloadIds(data, target.payloadKey);
            if (roleIds.length === 0) {
                throw new Error(target.emptySelectionError);
            }

            await assertActiveIds(
                target.getModel(service.server.db.models),
                roleIds,
                target.invalidSelectionError,
                transaction,
            );

            const roleMatches = await service.server.db.models.user_role_matching.findAll({
                where: {userRoleId: roleIds, deleted: false},
                attributes: ["userId", "userRoleId"],
                raw: true,
                transaction,
            });
            const uniqueRoleUserPairs = new Set();
            for (const roleMatch of roleMatches) {
                const userId = Number(roleMatch.userId);
                const roleId = Number(roleMatch.userRoleId);
                if (!Number.isInteger(userId) || userId <= 0 || userId === ownerUserId) continue;
                if (!Number.isInteger(roleId) || roleId <= 0) continue;
                uniqueRoleUserPairs.add(`${userId}:${roleId}`);
            }
            if (uniqueRoleUserPairs.size === 0) {
                throw new Error(target.emptyExpandedSelectionError);
            }

            const budgetFields = extractBudgetFields(data);
            return [...uniqueRoleUserPairs].map((pair) => {
                const [userIdText, roleIdText] = pair.split(":");
                return createShareRow(aiModel, Number(userIdText), expiryDate, {
                    roleId: Number(roleIdText),
                    ...budgetFields,
                });
            });
        },
    },
};

/**
 * Hydrates collaborator labels for persisted share snapshots using batched lookups.
 *
 * @param {{ db: Object }} server Accessor for `user` and `user_role` models.
 * @param {{ userId?: number, roleId?: number }[]} shares Rows selected from `ai_model_share`.
 */
async function loadShareEnrichmentMaps(server, shares) {
    const userIds = helpers.uniquePositiveInts(shares.map((share) => share.userId));
    const roleIds = helpers.uniquePositiveInts(shares.map((share) => share.roleId));

    const users = userIds.length === 0 ? [] : await server.db.models.user.findAll({
        where: {id: userIds, deleted: false},
        attributes: ["id", "firstName", "lastName", "userName", "email"],
        raw: true,
    });
    const userById = Object.fromEntries(users.map((userRow) => [Number(userRow.id), userRow]));

    const roles = roleIds.length === 0 ? [] : await server.db.models.user_role.findAll({
        where: {id: roleIds, deleted: false},
        attributes: ["id", "name"],
        raw: true,
    });
    const roleById = Object.fromEntries(roles.map((roleRow) => [Number(roleRow.id), roleRow]));

    return {userById, roleById};
}

/**
 * Seeds stepper/select lists scoped to users (excluding self) and global roles.
 *
 * @param {{ server: Object }} service AIService registry.
 * @param {{ userId?: number }} client Authenticated owner context.
 */
async function getModelShareOptions(service, client) {
    const ownerUserId = helpers.requireClientUserId(client);
    const db = service.server.db.models;

    const entries = await Promise.all(Object.values(SHARE_TARGETS).map(async (target) => {
        const rows = await target.getModel(db).findAll({
            where: target.getOptionWhere(db, ownerUserId),
            attributes: target.optionAttributes,
            order: target.optionOrder,
            raw: true,
        });
        return [target.responseKey, rows.map(target.mapOption)];
    }));

    return Object.fromEntries(entries);
}

/**
 * Reconstructs aggregated share knobs for reopening editors from normalized DB rows (mode/expiry/multi-select IDs).
 *
 * @param {{ server: Object }} service AIService.
 * @param {{ userId?: number }} client Owner context.
 * @param {{ aiModelId?: number }} data Identifies persisted model FK.
 */
async function getModelShareConfig(service, client, data) {
    const ownerUserId = helpers.requireClientUserId(client);
    const aiModel = await assertModelOwnership(service.server, ownerUserId, data?.aiModelId);

    const shares = await service.server.db.models.ai_model_share.findAll({
        where: {aiModelId: aiModel.id, studyId: null, studySessionId: null, deleted: false},
        attributes: ["id", "userId", "roleId", "expiryDate", "costLimit"],
        raw: true,
    });

    const {expiryDate} = helpers.shareAggregatesFromRows(shares);
    const configIdsByMode = Object.fromEntries(Object.values(SHARE_TARGETS).map((target) => [
        target.mode,
        target.getConfigIds(shares),
    ]));
    const activeTarget = Object.values(SHARE_TARGETS)
        .find((target) => configIdsByMode[target.mode]?.length > 0) || SHARE_TARGETS[DEFAULT_SHARE_MODE];

    // shareModel writes the same costLimit to every row in a batch, so the
    // first row's value represents the current setting for the form.
    const firstWithCostLimit = shares.find((row) => row.costLimit !== null && row.costLimit !== undefined);
    const costLimit = firstWithCostLimit ? firstWithCostLimit.costLimit : null;

    return {
        userIds: configIdsByMode.users || [],
        roleIds: configIdsByMode.roles || [],
        expiryDate,
        mode: activeTarget.mode,
        costLimit,
    };
}

/**
 * Returns differentiated payloads for organizers vs delegated viewers enforcing share expiry semantics.
 *
 * @param {{ server: Object }} service AIService.
 * @param {{ userId?: number }} client Possibly non-owner delegated user.
 * @param {{ aiModelId?: number }} data Requested model FK.
 */
async function getModelOverview(service, client, data) {
    const viewerUserId = helpers.requireClientUserId(client);
    const aiModel = await loadAiModelRow(service.server, data?.aiModelId);

    const now = new Date();
    const isOwner = Number(aiModel.userId) === viewerUserId;

    const viewerShare = await service.server.db.models.ai_model_share.findOne({
        where: {
            aiModelId: aiModel.id,
            userId: viewerUserId,
            deleted: false,
            expiryDate: {[Op.gt]: now},
        },
        attributes: ["expiryDate"],
        raw: true,
    });

    if (!isOwner && !viewerShare) {
        throw new Error("You do not have access to this model");
    }

    let shareRecipients = [];
    if (isOwner) {
        const shares = await service.server.db.models.ai_model_share.findAll({
            where: {
                aiModelId: aiModel.id,
                deleted: false,
                expiryDate: {[Op.gt]: now},
            },
            raw: true,
            order: [["expiryDate", "ASC"]],
        });
        const maps = await loadShareEnrichmentMaps(service.server, shares);
        shareRecipients = shares.map((share) => helpers.mapShareToRecipient(share, maps));
    }

    return {
        isOwner,
        viewerShare: !isOwner && viewerShare ? {expiryDate: viewerShare.expiryDate} : null,
        shareRecipients,
    };
}

/**
 * Re-materializes delegated access rows atomically (`users` or expanded `roles`).
 *
 * @param {{ server: Object }} service AIService.
 * @param {{ userId?: number }} client Organizer principal.
 * @param {{
 *   mode?: "users"|"roles",
 *   aiModelId?: number,
 *   expiryDate?: string,
 *   roleIds?: number[],
 *   userIds?: number[],
 * }} data Wizard payload reconstructed from dashboards.
 */
async function shareModel(service, client, data) {
    const ownerUserId = helpers.requireClientUserId(client);
    const target = getShareTarget(data?.mode);
    const expiryDate = helpers.parseShareExpiryInput(data?.expiryDate);
    const transaction = await service.server.db.sequelize.transaction();

    try {
        const aiModel = await assertModelOwnership(service.server, ownerUserId, data?.aiModelId, transaction);

        // Scope the wipe to global shares only — study-scoped rows belong to a
        // different lifecycle (study creation/deletion) and must not be touched
        // when the model owner re-shares globally. 
        // TODO: make sure with Akash
        await service.server.db.models.ai_model_share.update(
            {deleted: true, deletedAt: new Date()},
            {where: {aiModelId: aiModel.id, studyId: null, studySessionId: null,  deleted: false}, transaction},
        );

        const rowsToCreate = await target.createRows({
            service,
            ownerUserId,
            aiModel,
            expiryDate,
            data,
            transaction,
            target,
        });

        if (rowsToCreate.length > 0) {
            await service.server.db.models.ai_model_share.bulkCreate(rowsToCreate, {transaction});
        }

        await transaction.commit();
        return {ok: true, sharedCount: rowsToCreate.length};
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

/** Owner-id → label for AI model rows visible to `client` (`ai_model` autotable parity). */
async function getAiModelOwnerSummaries(service, client) {
    const viewerUserId = helpers.requireClientUserId(client);
    const db = service.server.db.models;
    let whereModel = {deleted: false};

    if (!(await client.isAdmin())) {
        const shareLinks = await db.ai_model_share.findAll({
            where: {
                userId: viewerUserId,
                deleted: false,
                expiryDate: {[Op.gt]: new Date()},
            },
            attributes: ["aiModelId"],
            raw: true,
        });
        const sharedIds = [...new Set(shareLinks.map((link) => link.aiModelId))];
        const orClauses = [{userId: viewerUserId}];
        if (sharedIds.length) {
            orClauses.push({id: {[Op.in]: sharedIds}});
        }
        whereModel = {[Op.and]: [whereModel, {[Op.or]: orClauses}]};
    }

    const visible = await db.ai_model.findAll({
        where: whereModel,
        attributes: ["userId"],
        raw: true,
    });
    const ownerIds = [...new Set(visible.map((row) => row.userId))]
        .map(Number)
        .filter((uid) => uid > 0 && uid !== viewerUserId);

    if (!ownerIds.length) {
        return {};
    }

    const users = await db.user.findAll({
        where: {id: ownerIds, deleted: false},
        attributes: ["id", "firstName", "lastName", "userName"],
        raw: true,
    });

    return users.reduce((acc, row) => {
        const label = helpers.userDisplayLabel(row) || row.userName;
        if (label) {
            acc[String(row.id)] = label;
        }
        return acc;
    }, {});
}

/**
 * Reset the per-user cost cap window on one share row.
 * Verifies the caller owns the underlying model before delegating to the budget module.
 *
 * @param {{ server: Object }} service AIService.
 * @param {{ userId?: number }} client Authenticated caller.
 * @param {{ shareId?: number, aiModelId?: number }} data RPC payload with the target share + model FK.
 * @returns {Promise<{ok: true}>}
 */
async function resetShareBudget(service, client, data) {
    const ownerUserId = helpers.requireClientUserId(client);
    await assertModelOwnership(service.server, ownerUserId, data?.aiModelId);
    await budget.resetShareBudget(service, data);
    return {ok: true};
}

/**
 * Reset the model-wide global cap window. Verifies caller owns the model.
 *
 * @param {{ server: Object }} service AIService.
 * @param {{ userId?: number }} client Authenticated caller.
 * @param {{ modelId?: number }} data RPC payload with the target model PK.
 * @returns {Promise<{ok: true}>}
 */
async function resetModelBudget(service, client, data) {
    const ownerUserId = helpers.requireClientUserId(client);
    await assertModelOwnership(service.server, ownerUserId, data?.modelId);
    await budget.resetModelBudget(service, data);
    return {ok: true};
}

/**
 * Read the study-level AI budget so the study form can prefill its AI fields
 *
 * @param {{ server: Object }} service AIService.
 * @param {{ userId?: number }} client Authenticated caller.
 * @param {{ studyId?: number }} data RPC payload with the target study PK.
 * @returns {Promise<{aiModelId: ?number, aiCostLimitPerUser: ?number, aiApplyPerSession: boolean}>}
 */
async function getStudyAiBudget(service, client, data) {
    helpers.requireClientUserId(client);
    const empty = {aiModelId: null, aiCostLimitPerUser: null, aiApplyPerSession: false};

    const studyId = Number(data?.studyId);
    if (!Number.isInteger(studyId) || studyId <= 0) return empty;

    const share = await service.server.db.models.ai_model_share.findOne({
        where: {studyId, studySessionId: null, deleted: false},
        attributes: ["aiModelId", "costLimit", "applyPerSession"],
        raw: true,
    });
    if (!share) return empty;

    return {
        aiModelId: share.aiModelId,
        aiCostLimitPerUser: share.costLimit,
        aiApplyPerSession: !!share.applyPerSession,
    };
}

module.exports = {
    getModelShareOptions,
    getModelShareConfig,
    getModelOverview,
    shareModel,
    getAiModelOwnerSummaries,
    resetShareBudget,
    resetModelBudget,
    getStudyAiBudget,
};
