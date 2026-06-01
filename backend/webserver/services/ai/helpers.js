"use strict";

/**
 * Stateless helpers shared by AIService handlers (share UX, normalization, prompts).
 *
 * @module webserver/services/ai/helpers
 * @author Akash Gundapuneni
 */

/**
 * Validates the RPC client's numeric `userId` or throws — share flows require a hardened principal.
 *
 * @param {{ userId?: number }} client Incoming RPC invocation context.
 * @returns {number} Positive finite user id suitable for Sequelize filters.
 */
function requireClientUserId(client) {
    const id = Number(client?.userId);
    if (!Number.isInteger(id) || id <= 0) {
        throw new Error("Invalid user context");
    }
    return id;
}

/**
 * Flattens OpenAI-compatible `messages` into a condensed multi-line auditing string while retaining role labels.
 *
 * @param {unknown} messages Serialized chat history from client/RPC payloads.
 * @returns {string|null}
 */
function extractInputText(messages) {
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

/**
 * Stable display string for collaborator pickers sourced from Sequelize `user` snapshots.
 *
 * @param {{ firstName?: string, lastName?: string }|null|undefined} user ORM/raw row backing label fields.
 * @returns {string|null}
 */
function userDisplayLabel(user) {
    if (!user) return null;
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
    return fullName || null;
}

/**
 * Dedupes non-zero integer-ish ids after optional coercion.
 *
 * @param {Iterable<unknown>} values Source iterable.
 * @param {(value: unknown) => number} [pick=(value)=>Number(value)] Mapper applied before filtration.
 * @returns {number[]}
 */
function uniquePositiveInts(values, pick = (x) => Number(x)) {
    return [...new Set((values || []).map(pick).filter((n) => Number.isInteger(n) && n > 0))];
}

/**
 * Summarizes `ai_model_share` rows into multi-select friendly identifiers for expiry editing.
 *
 * @param {{ userId?: number, roleId?: number, expiryDate?: unknown }[]} shares Persisted shares.
 * @returns {{ userIds:number[], roleIds:number[], expiryDate:string|null }}
 */
function shareAggregatesFromRows(shares) {
    const userIds = uniquePositiveInts(shares.map((share) => share.userId));
    const roleIds = uniquePositiveInts(shares.map((share) => share.roleId));
    const expiryCandidates = shares
        .map((share) => (share.expiryDate ? new Date(share.expiryDate) : null))
        .filter((value) => value && !Number.isNaN(value.getTime()));
    const expiryDate = expiryCandidates.length > 0
        ? new Date(Math.max(...expiryCandidates.map((value) => value.getTime()))).toISOString()
        : null;
    return {userIds, roleIds, expiryDate};
}

/**
 * Parses UX-provided expiry strings enforcing future dates compatible with Postgres `DATE` uploads.
 *
 * @param {unknown} rawExpiryDate Incoming date control payload.
 * @returns {Date} Normalized expiry at local end-of-day for `YYYY-MM-DD` syntax.
 */
function parseShareExpiryInput(rawExpiryDate) {
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

/**
 * Materializes richer labels for dashboards using pre-fetched dictionaries.
 *
 * @param {{ userId:number, roleId?:number|null, expiryDate?:unknown }} share Row payload.
 * @param {{ userById: Record<number,Object>, roleById: Record<number,Object> }} maps Hydrated lookups.
 * @returns {{ recipientLabel:string|null, accessVia:string, viaLabel:string|null, expiryDate?: unknown }}
 */
function mapShareToRecipient(share, maps) {
    const uid = Number(share.userId);
    let accessVia = "direct";
    let viaLabel = null;
    if (share.roleId) {
        accessVia = "role";
        const roleId = Number(share.roleId);
        viaLabel = maps.roleById[roleId]?.name || null;
    }

    // Compute a human-readable scope label so the overview can disambiguate
    // global / study / session shares without leaking raw ids.
    let scope = "Global";
    let scopeKind = "global";
    if (share.studySessionId) {
        const studyName = maps.studyById?.[Number(share.studyId)]?.name;
        scope = studyName
            ? `Session #${share.studySessionId} (${studyName})`
            : `Session #${share.studySessionId}`;
        scopeKind = "session";
    } else if (share.studyId) {
        const studyName = maps.studyById?.[Number(share.studyId)]?.name || `#${share.studyId}`;
        scope = share.applyPerSession
            ? `Study: ${studyName} (per session)`
            : `Study: ${studyName}`;
        scopeKind = "study";
    }

    return {
        id: share.id,
        recipientLabel: userDisplayLabel(maps.userById[uid]),
        accessVia,
        viaLabel,
        expiryDate: share.expiryDate,
        costLimit: share.costLimit ?? null,
        scope,
        scopeKind,
    };
}

module.exports = {
    requireClientUserId,
    extractInputText,
    userDisplayLabel,
    uniquePositiveInts,
    shareAggregatesFromRows,
    parseShareExpiryInput,
    mapShareToRecipient,
};
