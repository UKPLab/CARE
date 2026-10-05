/**
 * Credential and token columns. Never send them to a client, never search them.
 */
const SECRET_COLUMNS = [
    "passwordHash",
    "salt",
    "apiKey",
    "initialPassword",
    "resetToken",
    "emailVerificationToken",
    "twoFactorOtp",
    "twoFactorOtpExpiresAt",
    "totpSecret",
];

const SECRET_COLUMN_SET = new Set(SECRET_COLUMNS);

/** Row bookkeeping dropped together with secrets from query payloads and search. */
const HIDDEN_ROW_COLUMNS = ["deleted", "deletedAt", "rolesUpdatedAt"];

/**
 * Secret columns plus extra names that a particular payload also drops.
 * With no argument, also drops deleted / deletedAt / rolesUpdatedAt.
 * @param {string[]} [extra]
 * @returns {string[]}
 */
function hiddenColumns(extra = HIDDEN_ROW_COLUMNS) {
    return [...SECRET_COLUMNS, ...extra];
}

module.exports = {
    SECRET_COLUMNS,
    SECRET_COLUMN_SET,
    HIDDEN_ROW_COLUMNS,
    hiddenColumns,
};
