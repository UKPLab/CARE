"use strict";

const {Op} = require("sequelize");
const h = require("./helpers");

/** @param {import("sequelize").Transaction} [transaction] */
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

async function loadShareEnrichmentMaps(server, shares, ownerUserId) {
    const userIds = h.uniquePositiveInts(shares.map((s) => s.userId));
    const roleIds = h.uniquePositiveInts(shares.map((s) => s.roleId));
    const studyIds = h.uniquePositiveInts(shares.map((s) => s.studyId));

    const users = userIds.length === 0 ? [] : await server.db.models.user.findAll({
        where: {id: userIds, deleted: false},
        attributes: ["id", "firstName", "lastName", "userName", "email"],
        raw: true,
    });
    const userById = Object.fromEntries(users.map((u) => [Number(u.id), u]));

    const roles = roleIds.length === 0 ? [] : await server.db.models.user_role.findAll({
        where: {id: roleIds, deleted: false},
        attributes: ["id", "name"],
        raw: true,
    });
    const roleById = Object.fromEntries(roles.map((r) => [Number(r.id), r]));

    const studies = studyIds.length === 0 ? [] : await server.db.models.study.findAll({
        where: {
            id: studyIds,
            userId: Number(ownerUserId),
            deleted: false,
        },
        attributes: ["id", "name"],
        raw: true,
    });
    const studyById = Object.fromEntries(studies.map((st) => [Number(st.id), st]));

    return {userById, roleById, studyById};
}

async function getModelShareOptions(service, client) {
    const ownerUserId = h.requireClientUserId(client);
    const db = service.server.db.models;

    const [studies, users, roles] = await Promise.all([
        db.study.findAll({
            where: {userId: ownerUserId, deleted: false},
            attributes: ["id", "name"],
            order: [["name", "ASC"]],
            raw: true,
        }),
        db.user.findAll({
            where: {deleted: false, id: {[Op.ne]: ownerUserId}},
            attributes: ["id", "firstName", "lastName", "userName", "email"],
            order: [["firstName", "ASC"], ["lastName", "ASC"], ["userName", "ASC"]],
            raw: true,
        }),
        db.user_role.findAll({
            where: {deleted: false},
            attributes: ["id", "name"],
            order: [["name", "ASC"]],
            raw: true,
        }),
    ]);

    return {
        users: users.map((user) => ({
            id: user.id,
            label: h.userDisplayLabel(user),
        })),
        studies: studies.map((study) => ({
            id: study.id,
            label: study.name || `Study ${study.id}`,
        })),
        roles: roles.map((role) => ({
            id: role.id,
            label: role.name || `Role ${role.id}`,
        })),
    };
}

async function getModelShareConfig(service, client, data) {
    const ownerUserId = h.requireClientUserId(client);
    const aiModel = await assertModelOwnership(service.server, ownerUserId, data?.aiModelId);

    const shares = await service.server.db.models.ai_model_share.findAll({
        where: {aiModelId: aiModel.id, deleted: false},
        attributes: ["id", "userId", "studyId", "roleId", "expiryDate"],
        raw: true,
    });

    const {userIds, studyIds, roleIds, expiryDate} = h.shareAggregatesFromRows(shares);

    return {
        userIds,
        roleIds,
        studyId: studyIds[0] || null,
        expiryDate,
        mode: studyIds.length > 0 ? "study" : (roleIds.length > 0 ? "roles" : "users"),
    };
}

async function getModelOverview(service, client, data) {
    const viewerUserId = h.requireClientUserId(client);
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
        const maps = await loadShareEnrichmentMaps(service.server, shares, aiModel.userId);
        shareRecipients = shares.map((share) => h.mapShareToRecipient(share, maps));
    }

    return {
        isOwner,
        viewerShare: !isOwner && viewerShare ? {expiryDate: viewerShare.expiryDate} : null,
        shareRecipients,
    };
}

async function shareModel(service, client, data) {
    const ownerUserId = h.requireClientUserId(client);
    const mode = data?.mode === "study" ? "study" : (data?.mode === "roles" ? "roles" : "users");
    const expiryDate = h.parseShareExpiryInput(data?.expiryDate);
    const transaction = await service.server.db.sequelize.transaction();

    try {
        const aiModel = await assertModelOwnership(service.server, ownerUserId, data?.aiModelId, transaction);

        await service.server.db.models.ai_model_share.update(
            {deleted: true, deletedAt: new Date()},
            {where: {aiModelId: aiModel.id, deleted: false}, transaction},
        );

        const rowsToCreate = [];

        if (mode === "study") {
            const studyId = Number(data?.studyId);
            if (!Number.isInteger(studyId) || studyId <= 0) {
                throw new Error("Please select a study");
            }
            const study = await service.server.db.models.study.findOne({
                where: {id: studyId, userId: ownerUserId, deleted: false},
                raw: true,
                transaction,
            });
            if (!study) {
                throw new Error("Selected study is invalid");
            }

            const sessions = await service.server.db.models.study_session.findAll({
                where: {studyId, deleted: false},
                attributes: ["userId"],
                raw: true,
                transaction,
            });
            const participantUserIds = [...new Set(
                sessions
                    .map((session) => Number(session.userId))
                    .filter((userId) => Number.isInteger(userId) && userId > 0 && userId !== ownerUserId)
            )];

            if (participantUserIds.length === 0) {
                throw new Error("Selected study has no participants to share with");
            }

            for (const userId of participantUserIds) {
                rowsToCreate.push({
                    aiModelId: aiModel.id,
                    userId,
                    studyId,
                    roleId: null,
                    expiryDate,
                    deleted: false,
                });
            }
        } else if (mode === "roles") {
            const roleIds = h.uniquePositiveInts(Array.isArray(data?.roleIds) ? data.roleIds : []);
            if (roleIds.length === 0) {
                throw new Error("Please select at least one role");
            }

            const validRoles = await service.server.db.models.user_role.findAll({
                where: {id: roleIds, deleted: false},
                attributes: ["id"],
                raw: true,
                transaction,
            });
            const validRoleIds = new Set(validRoles.map((role) => Number(role.id)));
            if (roleIds.some((roleId) => !validRoleIds.has(roleId))) {
                throw new Error("One or more selected roles are invalid");
            }

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
                throw new Error("No users found for selected role(s)");
            }

            for (const pair of uniqueRoleUserPairs) {
                const [userIdText, roleIdText] = pair.split(":");
                rowsToCreate.push({
                    aiModelId: aiModel.id,
                    userId: Number(userIdText),
                    studyId: null,
                    roleId: Number(roleIdText),
                    expiryDate,
                    deleted: false,
                });
            }
        } else {
            const userIds = h.uniquePositiveInts(
                Array.isArray(data?.userIds) ? data.userIds : [],
                (value) => Number(value),
            ).filter((uid) => uid !== ownerUserId);

            if (userIds.length === 0) {
                throw new Error("Please select at least one user");
            }

            const validUsers = await service.server.db.models.user.findAll({
                where: {id: userIds, deleted: false},
                attributes: ["id"],
                raw: true,
                transaction,
            });
            const validUserIds = new Set(validUsers.map((user) => Number(user.id)));
            if (userIds.some((userId) => !validUserIds.has(userId))) {
                throw new Error("One or more selected users are invalid");
            }

            for (const userId of userIds) {
                rowsToCreate.push({
                    aiModelId: aiModel.id,
                    userId,
                    studyId: null,
                    roleId: null,
                    expiryDate,
                    deleted: false,
                });
            }
        }

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

module.exports = {
    getModelShareOptions,
    getModelShareConfig,
    getModelOverview,
    shareModel,
};
