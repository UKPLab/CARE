"use strict";

const { buildStudyHookKey } = require("../../../studyNlpDocumentData.js");

/**
 * Resolves NLP file mappings against event context values.
 *
 * @param {Object} mappings Action parameter mappings.
 * @param {Object} context Resolved event context.
 * @returns {Object}
 * @throws {Error} If a mapping cannot resolve its file id.
 */
function hydrateSkillParameterMappings(mappings, context) {
    const hydrated = {};

    for (const [paramName, mapping] of Object.entries(mappings || {})) {
        if (Array.isArray(mapping.fileIds) && mapping.fileIds.length) {
            hydrated[paramName] = mapping;
            continue;
        }

        if (!mapping.fromContext) {
            throw new Error(
                `NLP parameter ${paramName} does not define fileIds or fromContext.`
            );
        }

        const fileId = context[mapping.fromContext];
        if (!fileId) {
            throw new Error(
                `NLP parameter ${paramName} could not resolve ${mapping.fromContext}.`
            );
        }

        hydrated[paramName] = {
            ...mapping,
            fileIds: [fileId],
        };
        delete hydrated[paramName].fromContext;
    }

    return hydrated;
}

/**
 * Reads a configured AI hook id from current and legacy action fields.
 *
 * @param {Object} config Trigger action configuration.
 * @returns {number|null}
 */
function getConfiguredHookId(config) {
    const selected = config?.hookId
        ?? (config?.skillName?.startsWith("hook:")
            ? config.skillName.slice("hook:".length)
            : null);
    const hookId = Number(selected);
    return Number.isInteger(hookId) && hookId > 0 ? hookId : null;
}

/**
 * Runs an AI hook selected by a preprocessing trigger.
 *
 * @param {Object} server CARE server.
 * @param {Object} trigger Trigger row.
 * @param {Object} context Resolved event context.
 * @returns {Promise<Object>}
 * @throws {Error} If the hook or result document cannot be resolved.
 */
async function runAiHookTrigger(server, trigger, context) {
    const config = trigger.configuration?.action || {};
    const hookId = getConfiguredHookId(config);
    const inputMappings = config.inputMappings || {};
    const baseMapping = inputMappings[config.baseFileParameter];
    const service = server.services["AIService"];
    if (!hookId || !baseMapping || !service) {
        throw new Error("AI hook trigger is not configured correctly.");
    }

    const hook = await server.db.models["ai_hook"].getById(hookId);
    // Soft-skip before runHook: deleted hooks never reach AIService, but must not fail the job.
    if (!hook || hook.deleted || !hook.name) {
        server.logger.warn(
            `AI hook trigger soft-skip: hook ${hookId} unavailable`
        );
        return { choices: [], output: null };
    }

    let documentId = Number(baseMapping.documentId || context.documentId);
    if (baseMapping.type === "submission") {
        const submission = await server.db.models["submission"].findByPk(
            context.submissionId,
            { raw: true }
        );
        const baseType = (config.baseFiles || {})[submission?.validationConfigurationId]
            || baseMapping.selectedFiles?.[0];
        const documentTypes = server.db.models["document"].docTypes;
        const type = documentTypes[`DOC_TYPE_${String(baseType).toUpperCase()}`]
            ?? documentTypes.DOC_TYPE_ZIP;
        const resultDocument = await server.db.models["document"].findOne({
            where: { submissionId: context.submissionId, type, deleted: false },
            raw: true,
        });
        documentId = resultDocument?.id;
    }
    if (!documentId) {
        throw new Error("AI hook trigger could not resolve its result document.");
    }

    const values = {};
    for (const [placeholder, mapping] of Object.entries(inputMappings)) {
        if (placeholder === "output" || !mapping) {
            continue;
        }
        if (!["submission", "document", "configuration"].includes(mapping.type)) {
            throw new Error(`Unsupported AI hook input type "${mapping.type}".`);
        }
        values[placeholder] = {
            type: "serviceReplacement",
            input: {
                ...mapping,
                submissionId: mapping.submissionId || context.submissionId,
                documentId: mapping.documentId || documentId,
            },
        };
    }

    const userId = trigger.userId || context.userId;
    const result = await service.runHook({ userId }, {
        hookId,
        values,
        documentId,
    });

    await server.db.models["document_data"].upsertData({
        userId,
        documentId,
        studySessionId: null,
        studyStepId: null,
        key: buildStudyHookKey("nlpRequest", hook.name),
        value: result.output ?? "",
    });

    return { ...result, documentId };
}

/**
 * Runs the configured AI or NLP preprocessing action.
 *
 * @param {Object} server CARE server.
 * @param {Object} trigger Trigger row.
 * @param {Object} context Resolved event context.
 * @param {Object} options Runtime options.
 * @param {AbortSignal} [options.signal] Cancels active preprocessing.
 * @returns {Promise<*>}
 * @throws {Error} If the required service is unavailable.
 */
async function runAiPreprocessing(server, trigger, context, options = {}) {
    const config = trigger.configuration?.action || {};
    if (getConfiguredHookId(config)) {
        return await runAiHookTrigger(server, trigger, context);
    }

    const service = server.services["BackgroundTaskService"];
    if (!service) {
        throw new Error("BackgroundTaskService is not available.");
    }
    if (options.signal?.aborted) {
        throw new Error("Trigger preprocessing was cancelled.");
    }

    const socketId = `trigger:${trigger.id}:${Date.now()}`;
    const documentSocket = {
        userId: trigger.userId || context.userId,
        socket: {
            id: socketId,
            emit: async (event, payload) => {
                if (event !== "serviceRefresh" || payload.service !== "NLPService") {
                    return;
                }
                if (payload.type === "skillResults") {
                    await service.setResult(payload.data);
                }
                if (payload.type === "error" && typeof service.setError === "function") {
                    await service.setError(payload.data);
                }
            },
        },
        isAdmin: async () => true,
    };
    server.availSockets = server.availSockets || {};
    const previousSocket = server.availSockets[socketId];
    server.availSockets[socketId] = { DocumentSocket: documentSocket };
    const cancelPreprocessing = () => {
        service.cancelPreprocessing({ socket: { id: socketId } }).catch((error) => {
            server.logger.warn(
                `Failed to cancel trigger preprocessing: ${error.message}`
            );
        });
    };
    options.signal?.addEventListener("abort", cancelPreprocessing, { once: true });

    try {
        return await service.startPreprocessing(
            { socket: { id: socketId } },
            {
                skillName: config.skillName,
                skillParameterMappings: hydrateSkillParameterMappings(
                    config.skillParameterMappings,
                    context
                ),
                baseFileParameter: config.baseFileParameter,
                baseFiles: config.baseFiles,
                failOnItemError: true,
            }
        );
    } finally {
        options.signal?.removeEventListener("abort", cancelPreprocessing);
        if (previousSocket) {
            server.availSockets[socketId] = previousSocket;
        } else {
            delete server.availSockets[socketId];
        }
    }
}

module.exports = runAiPreprocessing;
