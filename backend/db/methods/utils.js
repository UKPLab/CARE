//create admin + guest user, if not existent
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