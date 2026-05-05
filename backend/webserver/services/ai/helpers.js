"use strict";

function requireClientUserId(client) {
    const id = Number(client?.userId);
    if (!Number.isInteger(id) || id <= 0) {
        throw new Error("Invalid user context");
    }
    return id;
}

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

function userDisplayLabel(user) {
    if (!user) return null;
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
    return fullName || null;
}

function uniquePositiveInts(values, pick = (x) => Number(x)) {
    return [...new Set((values || []).map(pick).filter((n) => Number.isInteger(n) && n > 0))];
}

function shareAggregatesFromRows(shares) {
    const userIds = uniquePositiveInts(shares.map((s) => s.userId));
    const studyIds = uniquePositiveInts(shares.map((s) => s.studyId));
    const roleIds = uniquePositiveInts(shares.map((s) => s.roleId));
    const expiryCandidates = shares
        .map((share) => (share.expiryDate ? new Date(share.expiryDate) : null))
        .filter((value) => value && !Number.isNaN(value.getTime()));
    const expiryDate = expiryCandidates.length > 0
        ? new Date(Math.max(...expiryCandidates.map((value) => value.getTime()))).toISOString()
        : null;
    return {userIds, studyIds, roleIds, expiryDate};
}

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

function mapShareToRecipient(share, maps) {
    const uid = Number(share.userId);
    let accessVia = "direct";
    let viaLabel = null;
    if (share.studyId) {
        accessVia = "study";
        const sid = Number(share.studyId);
        viaLabel = maps.studyById[sid]?.name || null;
    } else if (share.roleId) {
        accessVia = "role";
        const rid = Number(share.roleId);
        viaLabel = maps.roleById[rid]?.name || null;
    }
    return {
        recipientLabel: userDisplayLabel(maps.userById[uid]),
        accessVia,
        viaLabel,
        expiryDate: share.expiryDate,
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
