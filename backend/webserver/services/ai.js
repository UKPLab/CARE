const Service = require("../Service.js");
const {Op} = require("sequelize");

/**
 * AIService — AI / LLM and model-sharing RPC handlers.
 *
 * Client: `serviceCommand` + ack callback → `{ success, data }` or `{ success: false, message }`.
 *
 * Commands: chatCompletion, abortChatCompletion, getStatus, testModel,
 *           getModelShareOptions, getModelShareConfig, shareModel, getModelOverview.
 *
 * @class
 * @author Akash Gundapuneni
 * @extends Service
 */
module.exports = class AIService extends Service {
    constructor(server) {
        super(server, {
            cmdTypes: [
                "chatCompletion",
                "abortChatCompletion",
                "getStatus",
                "testModel",
                "getModelShareOptions",
                "getModelShareConfig",
                "shareModel",
                "getModelOverview",
            ],
            resTypes: [],
        });
    }

    async command(client, command, data) {
        const handlers = {
            chatCompletion: () => this.chatCompletion(client, data),
            abortChatCompletion: () => this.abortChatCompletion(data),
            getStatus: () => this.getStatus(),
            testModel: () => this.testModel(client, data),
            getModelShareOptions: () => this.getModelShareOptions(client),
            getModelShareConfig: () => this.getModelShareConfig(client, data),
            shareModel: () => this.shareModel(client, data),
            getModelOverview: () => this.getModelOverview(client, data),
        };
        if (handlers[command]) {
            return handlers[command]();
        }
        return super.command(client, command, data);
    }

    #getRPC() {
        return this.server.rpcs.LiteLLMRPC || null;
    }

    #normalizeProvider(provider) {
        return typeof provider === "string"
            ? provider.toLowerCase().replace(/\s+inference$/, "").trim()
            : "";
    }

    #resolveModelWithProvider(provider, model) {
        const rawModel = typeof model === "string" ? model.trim() : "";
        if (!rawModel) {
            return "";
        }
        const normalizedProvider = this.#normalizeProvider(provider);
        if (!normalizedProvider) {
            return rawModel;
        }
        const providerPrefix = `${normalizedProvider}/`;
        return rawModel.toLowerCase().startsWith(providerPrefix)
            ? rawModel
            : `${providerPrefix}${rawModel}`;
    }

    #extractResponseCost(payload) {
        if (!payload || typeof payload !== "object") {
            return null;
        }
        const cost = payload.response_cost
            ?? payload._hidden_params?.response_cost
            ?? null;
        const numericCost = Number(cost);
        return Number.isFinite(numericCost) ? numericCost : null;
    }

    #extractInputText(messages) {
        if (!Array.isArray(messages) || messages.length === 0) {
            return null;
        }
        const text = messages
            .map((message) => {
                const role = typeof message?.role === "string" ? message.role.trim() : "";
                const content = message?.content;
                let normalizedContent = "";
                if (typeof content === "string") {
                    normalizedContent = content.trim();
                } else if (Array.isArray(content)) {
                    normalizedContent = content
                        .map((part) => {
                            if (typeof part === "string") return part;
                            if (part && typeof part === "object" && typeof part.text === "string") {
                                return part.text;
                            }
                            return "";
                        })
                        .filter(Boolean)
                        .join("\n")
                        .trim();
                } else if (content !== null && content !== undefined) {
                    normalizedContent = String(content).trim();
                }
                if (!normalizedContent) {
                    return "";
                }
                return role ? `[${role}] ${normalizedContent}` : normalizedContent;
            })
            .filter(Boolean)
            .join("\n\n")
            .trim();

        return text || null;
    }

    #stringifyReasoningValue(value) {
        if (typeof value === "string") {
            const trimmed = value.trim();
            return trimmed || null;
        }
        if (Array.isArray(value)) {
            const text = value
                .map((part) => {
                    if (typeof part === "string") return part;
                    if (part && typeof part === "object" && typeof part.text === "string") return part.text;
                    return "";
                })
                .filter(Boolean)
                .join("\n")
                .trim();
            return text || null;
        }
        if (value && typeof value === "object") {
            const asJson = JSON.stringify(value);
            return asJson === "{}" ? null : asJson;
        }
        return null;
    }

    #extractReasoningText(payload) {
        if (!payload || typeof payload !== "object") {
            return null;
        }
        const choices = Array.isArray(payload.choices) ? payload.choices : [];
        const chunks = [];
        for (const choice of choices) {
            const message = choice?.message || {};
            const candidates = [
                message?.reasoning,
                message?.reasoning_content,
                message?.thinking,
                choice?.reasoning,
                choice?.reasoning_content,
                choice?.provider_specific_fields?.reasoning,
                choice?.provider_specific_fields?.reasoning_content,
                choice?.provider_specific_fields?.thinking,
            ];
            for (const candidate of candidates) {
                const text = this.#stringifyReasoningValue(candidate);
                if (text) chunks.push(text);
            }
        }
        if (chunks.length > 0) {
            return chunks.join("\n\n");
        }
        return this.#stringifyReasoningValue(
            payload?.provider_specific_fields?.reasoning
            ?? payload?.provider_specific_fields?.reasoning_content
            ?? payload?.provider_specific_fields?.thinking
            ?? null
        );
    }

    #requireClientUserId(client) {
        const id = Number(client?.userId);
        if (!Number.isInteger(id) || id <= 0) {
            throw new Error("Invalid user context");
        }
        return id;
    }

    /** @param {import("sequelize").Transaction} [transaction] */
    async #assertModelOwnership(ownerUserId, aiModelId, transaction) {
        const normalizedModelId = Number(aiModelId);
        if (!Number.isInteger(normalizedModelId) || normalizedModelId <= 0) {
            throw new Error("Missing or invalid aiModelId");
        }
        const aiModel = await this.server.db.models.ai_model.findOne({
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

    async #loadAiModelRow(aiModelId) {
        const id = Number(aiModelId);
        if (!Number.isInteger(id) || id <= 0) {
            throw new Error("Missing or invalid aiModelId");
        }
        const row = await this.server.db.models.ai_model.findOne({
            where: {id, deleted: false},
            raw: true,
        });
        if (!row) {
            throw new Error("AI model not found");
        }
        return row;
    }

    #uniquePositiveInts(values, pick = (x) => Number(x)) {
        return [...new Set((values || []).map(pick).filter((n) => Number.isInteger(n) && n > 0))];
    }

    /** Same display string as share-picker labels; null if user row missing. */
    #userDisplayLabel(user) {
        if (!user) return null;
        const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
        const fallback = user.userName || user.email || `User ${user.id}`;
        return fullName ? `${fullName} (${fallback})` : fallback;
    }

    #shareAggregatesFromRows(shares) {
        const userIds = this.#uniquePositiveInts(shares.map((s) => s.userId));
        const studyIds = this.#uniquePositiveInts(shares.map((s) => s.studyId));
        const roleIds = this.#uniquePositiveInts(shares.map((s) => s.roleId));
        const expiryCandidates = shares
            .map((share) => (share.expiryDate ? new Date(share.expiryDate) : null))
            .filter((value) => value && !Number.isNaN(value.getTime()));
        const expiryDate = expiryCandidates.length > 0
            ? new Date(Math.max(...expiryCandidates.map((value) => value.getTime()))).toISOString()
            : null;
        return {userIds, studyIds, roleIds, expiryDate};
    }

    async #loadShareEnrichmentMaps(shares, ownerUserId) {
        const userIds = this.#uniquePositiveInts(shares.map((s) => s.userId));
        const roleIds = this.#uniquePositiveInts(shares.map((s) => s.roleId));
        const studyIds = this.#uniquePositiveInts(shares.map((s) => s.studyId));

        const users = userIds.length === 0 ? [] : await this.server.db.models.user.findAll({
            where: {id: userIds, deleted: false},
            attributes: ["id", "firstName", "lastName", "userName", "email"],
            raw: true,
        });
        const userById = Object.fromEntries(users.map((u) => [Number(u.id), u]));

        const roles = roleIds.length === 0 ? [] : await this.server.db.models.user_role.findAll({
            where: {id: roleIds, deleted: false},
            attributes: ["id", "name"],
            raw: true,
        });
        const roleById = Object.fromEntries(roles.map((r) => [Number(r.id), r]));

        const studies = studyIds.length === 0 ? [] : await this.server.db.models.study.findAll({
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

    #mapShareToRecipient(share, maps) {
        const uid = Number(share.userId);
        let accessVia = "direct";
        let viaLabel = null;
        if (share.studyId) {
            accessVia = "study";
            const sid = Number(share.studyId);
            viaLabel = maps.studyById[sid]?.name || `Study ${sid}`;
        } else if (share.roleId) {
            accessVia = "role";
            const rid = Number(share.roleId);
            viaLabel = maps.roleById[rid]?.name || `Role ${rid}`;
        }
        return {
            recipientLabel: this.#userDisplayLabel(maps.userById[uid]) || `User ${uid}`,
            accessVia,
            viaLabel,
            expiryDate: share.expiryDate,
        };
    }

    #parseShareExpiryInput(rawExpiryDate) {
        const raw = typeof rawExpiryDate === "string" ? rawExpiryDate.trim() : "";
        if (!raw) {
            throw new Error("Expiry date is required");
        }
        let expiryDate;
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            const [yearText, monthText, dayText] = raw.split("-");
            expiryDate = new Date(Number(yearText), Number(monthText) - 1, Number(dayText), 23, 59, 59, 999);
        } else {
            expiryDate = new Date(raw);
        }
        if (Number.isNaN(expiryDate.getTime())) {
            throw new Error("Expiry date is invalid");
        }
        if (expiryDate <= new Date()) {
            throw new Error("Expiry date must be in the future");
        }
        return expiryDate;
    }

    async #resolveAiModelId(userId, data = {}) {
        const explicitId = Number(data?.aiModelId);
        if (Number.isInteger(explicitId) && explicitId > 0) {
            return explicitId;
        }

        const modelCandidates = [];
        const rawModel = typeof data?.model === "string" ? data.model.trim() : "";
        const resolvedModel = this.#resolveModelWithProvider(data?.provider, rawModel);
        if (rawModel) modelCandidates.push(rawModel);
        if (resolvedModel && resolvedModel !== rawModel) modelCandidates.push(resolvedModel);
        if (resolvedModel.includes("/")) {
            const modelWithoutProvider = resolvedModel.slice(resolvedModel.indexOf("/") + 1);
            if (modelWithoutProvider && !modelCandidates.includes(modelWithoutProvider)) {
                modelCandidates.push(modelWithoutProvider);
            }
        }
        if (modelCandidates.length === 0) {
            return null;
        }

        const normalizedProvider = this.#normalizeProvider(data?.provider);
        const where = {
            userId,
            deleted: false,
            model: modelCandidates,
        };
        if (normalizedProvider) {
            where.provider = normalizedProvider;
        }

        const aiModel = await this.server.db.models.ai_model.findOne({
            where,
            order: [["updatedAt", "DESC"]],
            raw: true,
        });
        return aiModel?.id || null;
    }

    async #logAiCall(logData) {
        try {
            await this.server.db.models.ai_log.add({
                userId: logData.userId,
                aiModelId: logData.aiModelId || null,
                requestId: logData.requestId || null,
                input: logData.input || null,
                output: logData.output || null,
                reasoning: logData.reasoning || null,
                inputTokens: logData.inputTokens ?? null,
                outputTokens: logData.outputTokens ?? null,
                totalTokens: logData.totalTokens ?? null,
                costs: logData.costs ?? null,
                status: logData.status || null,
                requestStart: logData.requestStart || null,
            });
        } catch (err) {
            this.logger.warn("Failed to write ai_log entry: " + err.message);
        }
    }

    async chatCompletion(client, data) {
        const rpc = this.#getRPC();
        if (!rpc) {
            this.logger.error("LiteLLM RPC is not registered");
            throw new Error("LiteLLM service is not available");
        }
        if (!(await rpc.isOnline())) {
            this.logger.error("LiteLLM RPC is not connected");
            throw new Error("LiteLLM service is not connected");
        }

        const requestStart = new Date();
        const aiModelId = await this.#resolveAiModelId(client?.userId, data);

        let response;
        try {
            response = await rpc.chatCompletion(data);
        } catch (err) {
            await this.#logAiCall({
                userId: client?.userId,
                aiModelId,
                requestId: data?.__requestId || null,
                input: this.#extractInputText(data?.messages),
                status: "failed",
                requestStart,
            });
            throw err;
        }
        const payload = response.data !== undefined ? response.data : response;

        const {choices = [], usage, model, id} = payload || {};
        const finishReasons = choices.map((c) => c.finish_reason).filter(Boolean);
        this.logger.info(
            `chatCompletion: id=${id} model=${model} ` +
            `tokens=${usage ? usage.total_tokens : "N/A"} ` +
            `finish=${finishReasons.join(",") || "N/A"}`
        );

        await this.#logAiCall({
            userId: client?.userId,
            aiModelId,
            requestId: id || data?.__requestId || null,
            input: this.#extractInputText(data?.messages),
            output: JSON.stringify(choices),
            reasoning: this.#extractReasoningText(payload),
            inputTokens: usage?.prompt_tokens ?? null,
            outputTokens: usage?.completion_tokens ?? null,
            totalTokens: usage?.total_tokens ?? null,
            costs: this.#extractResponseCost(payload),
            status: "success",
            requestStart,
        });

        return {choices};
    }

    async abortChatCompletion(data) {
        const rpc = this.#getRPC();
        if (!rpc || !(await rpc.isOnline())) {
            return {aborted: false, message: "LiteLLM service is not connected"};
        }

        return rpc.abortChatCompletion(data && data.requestId, data && data.reason);
    }

    async getStatus() {
        const rpc = this.#getRPC();
        if (!rpc) {
            return {online: false, error: "LiteLLM RPC not registered"};
        }
        try {
            return await rpc.getStatus();
        } catch (err) {
            this.logger.error("Failed to get LLM status: " + err.message);
            return {online: false, error: err.message};
        }
    }

    async getModelShareOptions(client) {
        const ownerUserId = this.#requireClientUserId(client);

        const [studies, users, roles] = await Promise.all([
            this.server.db.models.study.findAll({
                where: {userId: ownerUserId, deleted: false},
                attributes: ["id", "name"],
                order: [["name", "ASC"]],
                raw: true,
            }),
            this.server.db.models.user.findAll({
                where: {deleted: false, id: {[Op.ne]: ownerUserId}},
                attributes: ["id", "firstName", "lastName", "userName", "email"],
                order: [["firstName", "ASC"], ["lastName", "ASC"], ["userName", "ASC"]],
                raw: true,
            }),
            this.server.db.models.user_role.findAll({
                where: {deleted: false},
                attributes: ["id", "name"],
                order: [["name", "ASC"]],
                raw: true,
            }),
        ]);

        return {
            users: users.map((user) => ({
                id: user.id,
                label: this.#userDisplayLabel(user),
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

    async getModelShareConfig(client, data) {
        const ownerUserId = this.#requireClientUserId(client);
        const aiModel = await this.#assertModelOwnership(ownerUserId, data?.aiModelId);

        const shares = await this.server.db.models.ai_model_share.findAll({
            where: {aiModelId: aiModel.id, deleted: false},
            attributes: ["id", "userId", "studyId", "roleId", "expiryDate"],
            raw: true,
        });

        const {userIds, studyIds, roleIds, expiryDate} = this.#shareAggregatesFromRows(shares);

        return {
            userIds,
            roleIds,
            studyId: studyIds[0] || null,
            expiryDate,
            mode: studyIds.length > 0 ? "study" : (roleIds.length > 0 ? "roles" : "users"),
        };
    }

    async getModelOverview(client, data) {
        const viewerUserId = this.#requireClientUserId(client);
        const aiModel = await this.#loadAiModelRow(data?.aiModelId);

        const now = new Date();
        const isOwner = Number(aiModel.userId) === viewerUserId;

        const viewerShare = await this.server.db.models.ai_model_share.findOne({
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
            const shares = await this.server.db.models.ai_model_share.findAll({
                where: {
                    aiModelId: aiModel.id,
                    deleted: false,
                    expiryDate: {[Op.gt]: now},
                },
                raw: true,
                order: [["expiryDate", "ASC"]],
            });
            const maps = await this.#loadShareEnrichmentMaps(shares, aiModel.userId);
            shareRecipients = shares.map((share) => this.#mapShareToRecipient(share, maps));
        }

        return {
            isOwner,
            viewerShare: !isOwner && viewerShare ? {expiryDate: viewerShare.expiryDate} : null,
            shareRecipients,
        };
    }

    async shareModel(client, data) {
        const ownerUserId = this.#requireClientUserId(client);
        const mode = data?.mode === "study" ? "study" : (data?.mode === "roles" ? "roles" : "users");
        const expiryDate = this.#parseShareExpiryInput(data?.expiryDate);
        const transaction = await this.server.db.sequelize.transaction();

        try {
            const aiModel = await this.#assertModelOwnership(ownerUserId, data?.aiModelId, transaction);

            await this.server.db.models.ai_model_share.update(
                {deleted: true, deletedAt: new Date()},
                {where: {aiModelId: aiModel.id, deleted: false}, transaction},
            );

            const rowsToCreate = [];

            if (mode === "study") {
                const studyId = Number(data?.studyId);
                if (!Number.isInteger(studyId) || studyId <= 0) {
                    throw new Error("Please select a study");
                }
                const study = await this.server.db.models.study.findOne({
                    where: {id: studyId, userId: ownerUserId, deleted: false},
                    raw: true,
                    transaction,
                });
                if (!study) {
                    throw new Error("Selected study is invalid");
                }

                const sessions = await this.server.db.models.study_session.findAll({
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
                const roleIds = this.#uniquePositiveInts(Array.isArray(data?.roleIds) ? data.roleIds : []);
                if (roleIds.length === 0) {
                    throw new Error("Please select at least one role");
                }

                const validRoles = await this.server.db.models.user_role.findAll({
                    where: {id: roleIds, deleted: false},
                    attributes: ["id"],
                    raw: true,
                    transaction,
                });
                const validRoleIds = new Set(validRoles.map((role) => Number(role.id)));
                if (roleIds.some((roleId) => !validRoleIds.has(roleId))) {
                    throw new Error("One or more selected roles are invalid");
                }

                const roleMatches = await this.server.db.models.user_role_matching.findAll({
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
                const userIds = this.#uniquePositiveInts(
                    Array.isArray(data?.userIds) ? data.userIds : [],
                    (value) => Number(value),
                ).filter((uid) => uid !== ownerUserId);

                if (userIds.length === 0) {
                    throw new Error("Please select at least one user");
                }

                const validUsers = await this.server.db.models.user.findAll({
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
                await this.server.db.models.ai_model_share.bulkCreate(rowsToCreate, {transaction});
            }

            await transaction.commit();
            return {ok: true, sharedCount: rowsToCreate.length};
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async testModel(client, data) {
        const rpc = this.#getRPC();
        if (!rpc) {
            throw new Error("LiteLLM service is not available");
        }
        if (!(await rpc.isOnline())) {
            throw new Error("LiteLLM service is not connected");
        }

        const credentialId = Number(data?.credentialId);
        const model = typeof data?.model === "string" ? data.model.trim() : "";
        const provider = typeof data?.provider === "string" ? data.provider.trim() : "";
        if (!Number.isInteger(credentialId) || credentialId <= 0) {
            throw new Error("Missing or invalid credentialId");
        }
        if (!model) {
            throw new Error("Missing model");
        }

        let resolvedModel = this.#resolveModelWithProvider(provider, model);
        if (!resolvedModel.includes("/")) {
            throw new Error("Provider is required when model name has no provider prefix");
        }

        const credential = await this.server.db.models.ai_credential.getById(credentialId, {
            attributes: ["id", "userId", "apiKey", "apiBaseUrl", "apiVersion", "enabled", "deleted"],
        });
        if (!credential || credential.deleted) {
            throw new Error("Credential not found");
        }
        if (!client?.userId || credential.userId !== client.userId) {
            throw new Error("You are not allowed to access this credential");
        }
        if (!credential.enabled) {
            throw new Error("Credential is disabled");
        }

        const params = {
            model: resolvedModel,
            messages: [{role: "user", content: "ping"}],
            max_tokens: 16,
            api_key: credential.apiKey,
        };
        if (credential.apiBaseUrl) {
            params.api_base = credential.apiBaseUrl;
        }
        if (credential.apiVersion) {
            params.api_version = credential.apiVersion;
        }
        if (
            data?.additionalParameters &&
            typeof data.additionalParameters === "object" &&
            !Array.isArray(data.additionalParameters)
        ) {
            const reservedKeys = new Set([
                "model",
                "messages",
                "api_key",
                "api_base",
                "api_version",
                "max_tokens",
            ]);
            Object.assign(
                params,
                Object.fromEntries(
                    Object.entries(data.additionalParameters).filter(([key]) => !reservedKeys.has(key))
                )
            );
        }

        const requestStart = new Date();
        const aiModelId = await this.#resolveAiModelId(client?.userId, {
            aiModelId: data?.aiModelId,
            provider,
            model,
        });

        let response;
        try {
            response = await rpc.chatCompletion(params);
        } catch (err) {
            await this.#logAiCall({
                userId: client?.userId,
                aiModelId,
                requestId: null,
                input: this.#extractInputText(params.messages),
                status: "test_failed",
                requestStart,
            });
            throw err;
        }
        const payload = response?.data !== undefined ? response.data : response;
        const content = payload?.choices?.[0]?.message?.content;
        const usage = payload?.usage || {};

        let outputText = "";
        if (typeof content === "string") {
            outputText = content;
        } else if (Array.isArray(content)) {
            outputText = content
                .map((part) => {
                    if (typeof part === "string") return part;
                    if (part && typeof part === "object" && typeof part.text === "string") return part.text;
                    return "";
                })
                .filter(Boolean)
                .join("\n");
        } else if (content !== undefined && content !== null) {
            outputText = String(content);
        }

        await this.#logAiCall({
            userId: client?.userId,
            aiModelId,
            requestId: payload?.id || null,
            input: this.#extractInputText(params.messages),
            output: outputText || null,
            reasoning: this.#extractReasoningText(payload),
            inputTokens: usage?.prompt_tokens ?? null,
            outputTokens: usage?.completion_tokens ?? null,
            totalTokens: usage?.total_tokens ?? null,
            costs: this.#extractResponseCost(payload),
            status: "success",
            requestStart,
        });

        return {ok: true, outputText};
    }
};
