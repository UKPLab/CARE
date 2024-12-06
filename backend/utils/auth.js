/**
 * Helper functions for authentication.
 *
 * @author Nils Dycke, Dennis Zyska
 */
const crypto = require("crypto");

/**
 * Creates a password hash from a password and a salt.
 *
 * @param {string} password The password to hash.
 * @param {string} salt The salt to use.
 * @returns {Promise<string>} The hashed password.
 */
async function createPwd(password, salt) {
    return new Promise((res, rej) => {
        crypto.pbkdf2(password, salt, 310000, 32, 'sha256', (err, derivedKey) => {
            err ? rej(err) : res(derivedKey);
        });
    });
}

/**
 * Create a random password
 *
 * @param {number} length The password length
 * @param {boolean} withoutSpecialTokens don't use special characters
 * @returns {String} The random password
 */
exports.genPwd = function generatePassword(length, withoutSpecialTokens = false) {
    let characters;
    if (withoutSpecialTokens) {
        characters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz23456789';
    } else {
        characters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz23456789!@#$%^&*()_+[]{}|;:,.<>?';
    }
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    let password = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = array[i] % characters.length;
        password += characters[randomIndex];
    }
    return password;
}

/**
 * Generate a random salt.
 * @returns {string} The generated salt.
 */
exports.genSalt = function genSalt() {
    return crypto.randomBytes(16).toString("hex");
}

/**
 * Generate a password hash from a password and a salt.
 * @param password
 * @param salt
 * @return {Promise<string>} return the hashed password as hex string
 */
exports.genPwdHash = async function genPwdHash(password, salt) {
    let derivedKey = await createPwd(password, salt);

    return derivedKey.toString('hex');
}

/**
 * Remove sensitive fields from a user object.
 * @param {dict} user user object
 * @return {{[p: string]: any}}
 */
exports.relevantFields = function fields(user) {
    const exclude = ["passwordHash", "salt"]

    const entries = Object.entries(user);
    const filtered = entries.filter(([k, v]) => exclude.indexOf(k) === -1);

    return Object.fromEntries(filtered);
}