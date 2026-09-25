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

/**
 * Secret columns plus extra names that a particular payload also drops.
 * @param {string[]} [extra]
 * @returns {string[]}
 */
function hiddenColumns(extra = []) {
    return [...SECRET_COLUMNS, ...extra];
}

module.exports = {
    SECRET_COLUMNS,
    SECRET_COLUMN_SET,
    hiddenColumns,
};
