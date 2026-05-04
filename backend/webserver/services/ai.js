const Service = require("../Service.js");
const {Op} = require("sequelize");

/**
 * AIService - handles AI / LLM requests from the frontend.
 *
 * The client emits a `serviceCommand` with an ack callback and gets the
 * response back on that same callback (no `serviceRefresh` push events).
 *
 * Supported commands:
 *   - chatCompletion(data): forward the payload to LiteLLM as-is
 *   - abortChatCompletion(data): abort an in-flight LiteLLM request by id
 *   - getStatus():          report whether LiteLLM is reachable
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
                "getModelOverview"
            ],
            resTypes: []
        });
    }

    /**
     * Route a command to the matching handler.
     * Return values / thrown errors are forwarded to the client's ack callback
     * by Socket.createSocket as {success, data} or {success:false, message}.
     *
     * @param {object} client
     * @param {string} command
     * @param {object} data
     * @returns {Promise<*>}
     */
    async command(client, command, data) {
        switch (command) {
            case "chatCompletion":
                return await this.chatCompletion(client, data);
            case "abortChatCompletion":
                return await this.abortChatCompletion(data);
            case "getStatus":
                return await this.getStatus();
            case "testModel":
                return await this.testModel(client, data);
            case "getModelShareOptions":
                return await this.getModelShareOptions(client);
            case "getModelShareConfig":
                return await this.getModelShareConfig(client, data);
            case "shareModel":
                return await this.shareModel(client, data);
            case "getModelOverview":
                return await this.getModelOverview(client, data);
            default:
                return await super.command(client, command, data);
        }
    }

    /**
     * @returns {Object|null} The LiteLLMRPC instance, or null if not registered.
     */
    #getRPC() {
        return this.server.rpcs['LiteLLMRPC'] || null;
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

    async #assertModelOwnership(ownerUserId, aiModelId) {
        const normalizedModelId = Number(aiModelId);
        if (!Number.isInteger(normalizedModelId) || normalizedModelId <= 0) {
            throw new Error("Missing or invalid aiModelId");
        }
        const aiModel = await this.server.db.models["ai_model"].findOne({
            where: {
                id: normalizedModelId,
                deleted: false,
            },
            raw: true,
        });
        if (!aiModel) {
            throw new Error("AI model not found");
        }
        if (Number(aiModel.userId) !== Number(ownerUserId)) {
            throw new Error("You can only manage shares for models that you own");
        }
        return aiModel;
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

        const aiModel = await this.server.db.models["ai_model"].findOne({
            where,
            order: [["updatedAt", "DESC"]],
            raw: true,
        });
        return aiModel?.id || null;
    }

    async #logAiCall(logData) {
        try {
            await this.server.db.models["ai_log"].add({
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

    /**
     * Forward a chat completion request to LiteLLM.
     * Payload (model, messages, api_key, ...) is passed through untouched.
     *
     * The full response is logged server-side; only `choices` is returned
     * to the frontend. Add more fields here if a client needs them.
     *
     * @param {object} data
     * @param {string} data.model
     * @param {Array<Object>} data.messages
     * @returns {Promise<{choices: Array<Object>}>}
     * @throws {Error} if LiteLLM is unavailable or the call fails
     */
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
        const finishReasons = choices.map(c => c.finish_reason).filter(Boolean);
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

    /**
     * Abort an in-flight chat completion request.
     *
     * @param {object} data
     * @param {string} data.requestId frontend-generated request id
     * @param {string} [data.reason] diagnostic reason for logs
     * @returns {Promise<object>}
     */
    async abortChatCompletion(data) {
        const rpc = this.#getRPC();
        if (!rpc || !(await rpc.isOnline())) {
            return {aborted: false, message: "LiteLLM service is not connected"};
        }

        return await rpc.abortChatCompletion(data && data.requestId, data && data.reason);
    }

    /**
     * Report LiteLLM connection status.
     * Never throws - returns an object so the UI can render state directly.
     *
     * @returns {Promise<{online: boolean, error?: string}>}
     */
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
        const ownerUserId = Number(client?.userId);
        if (!Number.isInteger(ownerUserId) || ownerUserId <= 0) {
            throw new Error("Invalid user context");
        }

        const studies = await this.server.db.models["study"].findAll({
            where: {
                userId: ownerUserId,
                deleted: false,
            },
            attributes: ["id", "name"],
            order: [["name", "ASC"]],
            raw: true,
        });

        const users = await this.server.db.models["user"].findAll({
            where: {
                deleted: false,
                id: {
                    [Op.ne]: ownerUserId,
                },
            },
            attributes: ["id", "firstName", "lastName", "userName", "email"],
            order: [["firstName", "ASC"], ["lastName", "ASC"], ["userName", "ASC"]],
            raw: true,
        });

        const normalizedUsers = users.map((user) => {
            const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
            const fallback = user.userName || user.email || `User ${user.id}`;
            return {
                id: user.id,
                label: fullName ? `${fullName} (${fallback})` : fallback,
            };
        });

        const normalizedStudies = studies.map((study) => ({
            id: study.id,
            label: study.name || `Study ${study.id}`,
        }));
        const roles = await this.server.db.models["user_role"].findAll({
            where: {
                deleted: false,
            },
            attributes: ["id", "name"],
            order: [["name", "ASC"]],
            raw: true,
        });
        const normalizedRoles = roles.map((role) => ({
            id: role.id,
            label: role.name || `Role ${role.id}`,
        }));

        return {
            users: normalizedUsers,
            studies: normalizedStudies,
            roles: normalizedRoles,
        };
    }

    async getModelShareConfig(client, data) {
        const ownerUserId = Number(client?.userId);
        const aiModel = await this.#assertModelOwnership(ownerUserId, data?.aiModelId);

        const shares = await this.server.db.models["ai_model_share"].findAll({
            where: {
                aiModelId: aiModel.id,
                deleted: false,
            },
            attributes: ["id", "userId", "studyId", "roleId", "expiryDate"],
            raw: true,
        });

        const userIds = [...new Set(
            shares
                .map((share) => Number(share.userId))
                .filter((value) => Number.isInteger(value) && value > 0)
        )];
        const studyIds = [...new Set(
            shares
                .map((share) => Number(share.studyId))
                .filter((value) => Number.isInteger(value) && value > 0)
        )];
        const roleIds = [...new Set(
            shares
                .map((share) => Number(share.roleId))
                .filter((value) => Number.isInteger(value) && value > 0)
        )];
        const expiryCandidates = shares
            .map((share) => share.expiryDate ? new Date(share.expiryDate) : null)
            .filter((value) => value && !Number.isNaN(value.getTime()));
        const expiryDate = expiryCandidates.length > 0
            ? new Date(Math.max(...expiryCandidates.map((value) => value.getTime()))).toISOString()
            : null;

        return {
            userIds,
            roleIds,
            studyId: studyIds[0] || null,
            expiryDate,
            mode: studyIds.length > 0 ? "study" : (roleIds.length > 0 ? "roles" : "users"),
        };
    }

    async getModelOverview(client, data) {
        const viewerUserId = Number(client?.userId);
        if (!Number.isInteger(viewerUserId) || viewerUserId <= 0) {
            throw new Error("Invalid user context");
        }
        const aiModelId = Number(data?.aiModelId);
        if (!Number.isInteger(aiModelId) || aiModelId <= 0) {
            throw new Error("Missing or invalid aiModelId");
        }

        const aiModel = await this.server.db.models["ai_model"].findOne({
            where: {
                id: aiModelId,
                deleted: false,
            },
            raw: true,
        });
        if (!aiModel) {
            throw new Error("AI model not found");
        }

        const now = new Date();
        const isOwner = Number(aiModel.userId) === viewerUserId;

        const viewerShare = await this.server.db.models["ai_model_share"].findOne({
            where: {
                aiModelId,
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

        const recipientLabel = (user, uid) => {
            if (!user) return `User ${uid}`;
            const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
            const fb = user.userName || user.email || `User ${user.id}`;
            return fullName ? `${fullName} (${fb})` : fb;
        };

        let shareRecipients = [];
        if (isOwner) {
            const shares = await this.server.db.models["ai_model_share"].findAll({
                where: {
                    aiModelId,
                    deleted: false,
                    expiryDate: {[Op.gt]: now},
                },
                raw: true,
                order: [["expiryDate", "ASC"]],
            });

            const userIds = [...new Set(shares.map((s) => Number(s.userId)).filter((id) => Number.isInteger(id) && id > 0))];
            const roleIds = [...new Set(shares.map((s) => Number(s.roleId)).filter((id) => Number.isInteger(id) && id > 0))];
            const studyIds = [...new Set(shares.map((s) => Number(s.studyId)).filter((id) => Number.isInteger(id) && id > 0))];

            const users = userIds.length > 0
                ? await this.server.db.models["user"].findAll({
                    where: {id: userIds, deleted: false},
                    attributes: ["id", "firstName", "lastName", "userName", "email"],
                    raw: true,
                })
                : [];
            const userById = Object.fromEntries(users.map((u) => [Number(u.id), u]));

            const roles = roleIds.length > 0
                ? await this.server.db.models["user_role"].findAll({
                    where: {id: roleIds, deleted: false},
                    attributes: ["id", "name"],
                    raw: true,
                })
                : [];
            const roleById = Object.fromEntries(roles.map((r) => [Number(r.id), r]));

            const studies = studyIds.length > 0
                ? await this.server.db.models["study"].findAll({
                    where: {
                        id: studyIds,
                        userId: Number(aiModel.userId),
                        deleted: false,
                    },
                    attributes: ["id", "name"],
                    raw: true,
                })
                : [];
            const studyById = Object.fromEntries(studies.map((st) => [Number(st.id), st]));

            shareRecipients = shares.map((share) => {
                const uid = Number(share.userId);
                let accessVia = "direct";
                let viaLabel = null;
                if (share.studyId) {
                    accessVia = "study";
                    const sid = Number(share.studyId);
                    viaLabel = studyById[sid]?.name || `Study ${sid}`;
                } else if (share.roleId) {
                    accessVia = "role";
                    const rid = Number(share.roleId);
                    viaLabel = roleById[rid]?.name || `Role ${rid}`;
                }
                return {
                    recipientLabel: recipientLabel(userById[uid], uid),
                    accessVia,
                    viaLabel,
                    expiryDate: share.expiryDate,
                };
            });
        }

        return {
            isOwner,
            viewerShare: !isOwner && viewerShare
                ? {expiryDate: viewerShare.expiryDate}
                : null,
            shareRecipients,
        };
    }

    async shareModel(client, data) {
        const ownerUserId = Number(client?.userId);
        const aiModel = await this.#assertModelOwnership(ownerUserId, data?.aiModelId);
        const mode = data?.mode === "study" ? "study" : (data?.mode === "roles" ? "roles" : "users");
        const rawExpiryDate = typeof data?.expiryDate === "string" ? data.expiryDate.trim() : "";
        if (!rawExpiryDate) {
            throw new Error("Expiry date is required");
        }
        let expiryDate = null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(rawExpiryDate)) {
            const [yearText, monthText, dayText] = rawExpiryDate.split("-");
            const year = Number(yearText);
            const month = Number(monthText);
            const day = Number(dayText);
            expiryDate = new Date(year, month - 1, day, 23, 59, 59, 999);
        } else {
            expiryDate = new Date(rawExpiryDate);
        }
        if (Number.isNaN(expiryDate.getTime())) {
            throw new Error("Expiry date is invalid");
        }
        if (expiryDate <= new Date()) {
            throw new Error("Expiry date must be in the future");
        }
        const transaction = await this.server.db.sequelize.transaction();

        try {
            await this.server.db.models["ai_model_share"].update(
                {
                    deleted: true,
                    deletedAt: new Date(),
                },
                {
                    where: {
                        aiModelId: aiModel.id,
                        deleted: false,
                    },
                    transaction,
                }
            );

            const rowsToCreate = [];

            if (mode === "study") {
                const studyId = Number(data?.studyId);
                if (!Number.isInteger(studyId) || studyId <= 0) {
                    throw new Error("Please select a study");
                }
                const study = await this.server.db.models["study"].findOne({
                    where: {
                        id: studyId,
                        userId: ownerUserId,
                        deleted: false,
                    },
                    raw: true,
                    transaction,
                });
                if (!study) {
                    throw new Error("Selected study is invalid");
                }

                const sessions = await this.server.db.models["study_session"].findAll({
                    where: {
                        studyId,
                        deleted: false,
                    },
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
                const requestedRoleIds = Array.isArray(data?.roleIds) ? data.roleIds : [];
                const roleIds = [...new Set(
                    requestedRoleIds
                        .map((value) => Number(value))
                        .filter((value) => Number.isInteger(value) && value > 0)
                )];
                if (roleIds.length === 0) {
                    throw new Error("Please select at least one role");
                }

                const validRoles = await this.server.db.models["user_role"].findAll({
                    where: {
                        id: roleIds,
                        deleted: false,
                    },
                    attributes: ["id"],
                    raw: true,
                    transaction,
                });
                const validRoleIds = new Set(validRoles.map((role) => Number(role.id)));
                const invalidRoleCount = roleIds.filter((roleId) => !validRoleIds.has(roleId)).length;
                if (invalidRoleCount > 0) {
                    throw new Error("One or more selected roles are invalid");
                }

                const roleMatches = await this.server.db.models["user_role_matching"].findAll({
                    where: {
                        userRoleId: roleIds,
                        deleted: false,
                    },
                    attributes: ["userId", "userRoleId"],
                    raw: true,
                    transaction,
                });
                const uniqueRoleUserPairs = new Set();
                for (const roleMatch of roleMatches) {
                    const userId = Number(roleMatch.userId);
                    const roleId = Number(roleMatch.userRoleId);
                    if (!Number.isInteger(userId) || userId <= 0 || userId === ownerUserId) {
                        continue;
                    }
                    if (!Number.isInteger(roleId) || roleId <= 0) {
                        continue;
                    }
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
                const requestedUserIds = Array.isArray(data?.userIds) ? data.userIds : [];
                const userIds = [...new Set(
                    requestedUserIds
                        .map((value) => Number(value))
                        .filter((value) => Number.isInteger(value) && value > 0 && value !== ownerUserId)
                )];

                if (userIds.length === 0) {
                    throw new Error("Please select at least one user");
                }

                const validUsers = await this.server.db.models["user"].findAll({
                    where: {
                        id: userIds,
                        deleted: false,
                    },
                    attributes: ["id"],
                    raw: true,
                    transaction,
                });
                const validUserIds = new Set(validUsers.map((user) => Number(user.id)));
                const invalidCount = userIds.filter((userId) => !validUserIds.has(userId)).length;
                if (invalidCount > 0) {
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
                await this.server.db.models["ai_model_share"].bulkCreate(rowsToCreate, {transaction});
            }

            await transaction.commit();
            return {ok: true, sharedCount: rowsToCreate.length};
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
     * Test if a model is usable with the selected credential.
     *
     * @param {object} client
     * @param {object} data
     * @param {number} data.credentialId
     * @param {string} data.model
     * @param {object} [data.additionalParameters]
     * @returns {Promise<{ok:boolean, preview?:string}>}
     */
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

        const credential = await this.server.db.models["ai_credential"].getById(credentialId, {
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
            const safeAdditionalParameters = Object.fromEntries(
                Object.entries(data.additionalParameters)
                    .filter(([key]) => !reservedKeys.has(key))
            );
            Object.assign(params, safeAdditionalParameters);
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
                    if (typeof part === "string") {
                        return part;
                    }
                    if (part && typeof part === "object" && typeof part.text === "string") {
                        return part.text;
                    }
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
