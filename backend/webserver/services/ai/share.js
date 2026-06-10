"use strict";

/**
 * Handlers backing AI model-sharing flows (ownership checks, hydrate UI selectors, transactional writes).
 *
 * @module webserver/services/ai/share
 * @author Akash Gundapuneni
 */

const {Op} = require("sequelize");
const helpers = require("./helpers");

const DEFAULT_SHARE_MODE = "users";

const SHARE_RESOURCES = {
    model: {
        resourceTable: "ai_model",
        shareTable: "ai_model_share",
        payloadKey: "aiModelId",
        resourceKey: "aiModelId",
        missingIdError: "Missing or invalid aiModelId",
        notFoundError: "AI model not found",
        ownerError: "You can only manage shares for models that you own",
    },
    hook: {
        resourceTable: "ai_hook",
        shareTable: "ai_hook_share",
        payloadKey: "aiHookId",
        resourceKey: "aiHookId",
        missingIdError: "Missing or invalid aiHookId",
        notFoundError: "AI hook not found",
        ownerError: "You can only manage shares for hooks that you own",
    },
};

function getResourceId(resource, data) {
    const id = Number(data?.[resource.payloadKey]);
    if (!Number.isInteger(id) || id <= 0) {
        throw new Error(resource.missingIdError);
    }
    return id;
}

async function loadResource(server, resource, id, transaction) {
    const row = await server.db.models[resource.resourceTable].findOne({
        where: {id, deleted: false},
        raw: true,
        transaction,
    });
    if (!row) {
        throw new Error(resource.notFoundError);
    }
    return row;
}

async function assertResourceOwnership(server, ownerUserId, resource, data, transaction) {
    const row = await loadResource(server, resource, getResourceId(resource, data), transaction);
    if (Number(row.userId) !== Number(ownerUserId)) {
        throw new Error(resource.ownerError);
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
 * Creates one resource share row snapshot.
 *
 * @param {string} resourceKey Share-table FK column name.
 * @param {object} resource Target model or hook.
 * @param {number} userId Recipient user id.
 * @param {Date} expiryDate Share expiry.
 * @param {object} [extra] Additional grant metadata.
 */
function createShareRow(resourceKey, resource, userId, expiryDate, extra = {}) {
    return {
        [resourceKey]: resource.id,
        userId,
        roleId: null,
        expiryDate,
        deleted: false,
        ...extra,
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
        createRows: async ({service, ownerUserId, resource, resourceKey, expiryDate, data, transaction, target}) => {
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

            return userIds.map((userId) => createShareRow(resourceKey, resource, userId, expiryDate));
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
        createRows: async ({service, ownerUserId, resource, resourceKey, expiryDate, data, transaction, target}) => {
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

            return [...uniqueRoleUserPairs].map((pair) => {
                const [userIdText, roleIdText] = pair.split(":");
                return createShareRow(resourceKey, resource, Number(userIdText), expiryDate, {
                    roleId: Number(roleIdText),
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

function mapShareConfig(shares) {
    const {expiryDate} = helpers.shareAggregatesFromRows(shares);
    const configIdsByMode = Object.fromEntries(Object.values(SHARE_TARGETS).map((target) => [
        target.mode,
        target.getConfigIds(shares),
    ]));
    const activeTarget = Object.values(SHARE_TARGETS)
        .find((target) => configIdsByMode[target.mode]?.length > 0) || SHARE_TARGETS[DEFAULT_SHARE_MODE];

    return {
        userIds: configIdsByMode.users || [],
        roleIds: configIdsByMode.roles || [],
        expiryDate,
        mode: activeTarget.mode,
    };
}

async function getResourceShareConfig(service, client, data, resource) {
    const ownerUserId = helpers.requireClientUserId(client);
    const row = await assertResourceOwnership(service.server, ownerUserId, resource, data);

    const shares = await service.server.db.models[resource.shareTable].findAll({
        where: {[resource.resourceKey]: row.id, deleted: false},
        attributes: ["id", "userId", "roleId", "expiryDate"],
        raw: true,
    });

    return mapShareConfig(shares);
}

/**
 * Reconstructs aggregated share knobs for reopening editors from normalized DB rows (mode/expiry/multi-select IDs).
 *
 * @param {{ server: Object }} service AIService.
 * @param {{ userId?: number }} client Owner context.
 * @param {{ aiModelId?: number }} data Identifies persisted model FK.
 */
async function getModelShareConfig(service, client, data) {
    return getResourceShareConfig(service, client, data, SHARE_RESOURCES.model);
}

/**
 * Reconstructs aggregated hook share knobs for reopening editors.
 *
 * @param {{ server: Object }} service AIService.
 * @param {{ userId?: number }} client Owner context.
 * @param {{ aiHookId?: number }} data Identifies persisted hook FK.
 */
async function getHookShareConfig(service, client, data) {
    return getResourceShareConfig(service, client, data, SHARE_RESOURCES.hook);
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
    const aiModel = await loadResource(
        service.server,
        SHARE_RESOURCES.model,
        getResourceId(SHARE_RESOURCES.model, data),
    );

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
 * Adds selected share rows without removing existing recipients.
 * Existing direct/role grants for the same recipient are refreshed with the new expiry.
 *
 * @param {import("sequelize").Model} shareModel Share table model.
 * @param {string} resourceKey FK column name on the share table.
 * @param {number} resourceId Shared model/hook id.
 * @param {object[]} rowsToCreate Normalized share rows requested by the UI.
 * @param {import("sequelize").Transaction} transaction Sequelize transaction scope.
 */
async function extendShareRows(shareModel, resourceKey, resourceId, rowsToCreate, transaction) {
    const existingRows = await shareModel.findAll({
        where: {[resourceKey]: resourceId},
        attributes: ["id", "userId", "roleId", "deleted"],
        raw: true,
        transaction,
    });
    const existingByRecipient = new Map();
    for (const row of existingRows) {
        const key = `${Number(row.userId)}:${Number(row.roleId) || 0}`;
        if (!existingByRecipient.has(key) || !row.deleted) {
            existingByRecipient.set(key, row);
        }
    }

    let changedCount = 0;
    for (const row of rowsToCreate) {
        const key = `${Number(row.userId)}:${Number(row.roleId) || 0}`;
        const existing = existingByRecipient.get(key);
        if (existing) {
            await shareModel.update(
                {expiryDate: row.expiryDate, deleted: false, deletedAt: null},
                {where: {id: existing.id}, transaction},
            );
        } else {
            await shareModel.create(row, {transaction});
        }
        changedCount += 1;
    }

    return changedCount;
}

async function shareResource(service, client, data, resource) {
    const ownerUserId = helpers.requireClientUserId(client);
    const target = getShareTarget(data?.mode);
    const expiryDate = helpers.parseShareExpiryInput(data?.expiryDate);
    const transaction = await service.server.db.sequelize.transaction();

    try {
        const row = await assertResourceOwnership(service.server, ownerUserId, resource, data, transaction);

        const rowsToCreate = await target.createRows({
            service,
            ownerUserId,
            resource: row,
            resourceKey: resource.resourceKey,
            expiryDate,
            data,
            transaction,
            target,
        });

        const sharedCount = await extendShareRows(
            service.server.db.models[resource.shareTable],
            resource.resourceKey,
            row.id,
            rowsToCreate,
            transaction,
        );

        await transaction.commit();
        return {ok: true, sharedCount};
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

/**
 * Extends delegated access rows atomically (`users` or expanded `roles`).
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
    return shareResource(service, client, data, SHARE_RESOURCES.model);
}

/**
 * Extends delegated AI hook access rows atomically (`users` or expanded `roles`).
 *
 * @param {{ server: Object }} service AIService.
 * @param {{ userId?: number }} client Organizer principal.
 * @param {{
 *   mode?: "users"|"roles",
 *   aiHookId?: number,
 *   expiryDate?: string,
 *   roleIds?: number[],
 *   userIds?: number[],
 * }} data Wizard payload reconstructed from dashboards.
 */
async function shareHook(service, client, data) {
    return shareResource(service, client, data, SHARE_RESOURCES.hook);
}

async function loadVisibleResources(service, client, resource, attributes = ["id", "userId"]) {
    const viewerUserId = helpers.requireClientUserId(client);
    const db = service.server.db.models;
    let whereResource = {deleted: false};

    if (!(await client.isAdmin())) {
        const shareLinks = await db[resource.shareTable].findAll({
            where: {
                userId: viewerUserId,
                deleted: false,
                expiryDate: {[Op.gt]: new Date()},
            },
            attributes: [resource.resourceKey],
            raw: true,
        });
        const sharedIds = helpers.uniquePositiveInts(shareLinks.map((link) => link[resource.resourceKey]));
        const orClauses = [{userId: viewerUserId}];
        if (sharedIds.length) {
            orClauses.push({id: {[Op.in]: sharedIds}});
        }
        whereResource = {[Op.and]: [whereResource, {[Op.or]: orClauses}]};
    }

    return db[resource.resourceTable].findAll({
        where: whereResource,
        attributes,
        raw: true,
    });
}

async function getResourceOwnerSummaries(service, client, resource) {
    const viewerUserId = helpers.requireClientUserId(client);
    const db = service.server.db.models;
    const visible = await loadVisibleResources(service, client, resource, ["userId"]);
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

/** Owner-id → label for AI model rows visible to `client` (`ai_model` autotable parity). */
async function getAiModelOwnerSummaries(service, client) {
    return getResourceOwnerSummaries(service, client, SHARE_RESOURCES.model);
}

/** Owner-id → label for AI hook rows visible to `client` (`ai_hook` autotable parity). */
async function getAiHookOwnerSummaries(service, client) {
    return getResourceOwnerSummaries(service, client, SHARE_RESOURCES.hook);
}

/** Hook-id → ordered model labels for hook rows visible to `client`, without sharing model records. */
async function getAiHookDisplaySummaries(service, client) {
    helpers.requireClientUserId(client);
    const db = service.server.db.models;
    const visibleHooks = await loadVisibleResources(service, client, SHARE_RESOURCES.hook, ["id"]);
    const hookIds = helpers.uniquePositiveInts(visibleHooks.map((hook) => hook.id));
    if (hookIds.length === 0) {
        return {};
    }

    const hookModels = await db.ai_hook_models.findAll({
        where: {aiHookId: hookIds, deleted: false},
        attributes: ["aiHookId", "aiModelId", "priority"],
        order: [["aiHookId", "ASC"], ["priority", "ASC"]],
        raw: true,
    });
    const modelIds = helpers.uniquePositiveInts(hookModels.map((row) => row.aiModelId));
    const models = modelIds.length === 0 ? [] : await db.ai_model.findAll({
        where: {id: modelIds, deleted: false},
        attributes: ["id", "name", "model"],
        raw: true,
    });
    const modelById = Object.fromEntries(models.map((model) => [Number(model.id), model]));

    return hookModels.reduce((acc, row) => {
        const hookId = String(row.aiHookId);
        const model = modelById[Number(row.aiModelId)];
        const name = model?.name || `Model #${row.aiModelId}`;
        if (!acc[hookId]) {
            acc[hookId] = {models: []};
        }
        acc[hookId].models.push({
            priority: Number(row.priority),
            aiModelId: Number(row.aiModelId),
            name,
            model: model?.model || null,
        });
        const primaryModel = acc[hookId].models[0];
        const extraModelCount = Math.max(acc[hookId].models.length - 1, 0);
        acc[hookId].modelSummary = primaryModel
            ? `${primaryModel.name}${extraModelCount > 0 ? ` +${extraModelCount}` : ""}`
            : "Unknown model";
        return acc;
    }, {});
}

module.exports = {
    getModelShareOptions,
    getModelShareConfig,
    getHookShareConfig,
    getModelOverview,
    shareModel,
    shareHook,
    getAiModelOwnerSummaries,
    getAiHookOwnerSummaries,
    getAiHookDisplaySummaries,
};
