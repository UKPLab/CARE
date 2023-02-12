/**
 * Helper functions for authentication.
 * @author Nils Dycke, Dennis Zyska
 */
const crypto = require("crypto");

async function createPwd(password, salt) {
    return new Promise((res, rej) => {
        crypto.pbkdf2(password, salt, 310000, 32, 'sha256', (err, derivedKey) => {
            err ? rej(err) : res(derivedKey);
        });
    });
}

exports.genSalt = function genSalt() {
    return crypto.randomBytes(16).toString("hex");
}

exports.genPwdHash = async function genPwdHash(password, salt) {
    let derivedKey = await createPwd(password, salt);

    return derivedKey.toString('hex');
}

exports.relevantFields = function fields(user) {
    const exclude = ["passwordHash", "salt"]

    const entries = Object.entries(user.dataValues);
    const filtered = entries.filter(([k, v]) => exclude.indexOf(k) === -1);

    return Object.fromEntries(filtered);
}