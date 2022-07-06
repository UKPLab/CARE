const crypto = require("crypto");

//create admin + guest user, if not existent
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

exports.add = async function add(user_name, first_name, last_name, user_email, password, role) {
    const salt = this.genSalt();
    const pwd = this.genPwdHash(password, salt);
}