'use strict';

const crypto = require('crypto');

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
function genPwd(length, withoutSpecialTokens = false) {
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
function genSalt() {
    return crypto.randomBytes(16).toString("hex");
}

/**
 * Generate a password hash from a password and a salt.
 * @param password
 * @param salt
 * @return {Promise<string>} return the hashed password as hex string
 */
async function genPwdHash(password, salt) {
    let derivedKey = await createPwd(password, salt);

    return derivedKey.toString('hex');
}

/**
 * Remove sensitive fields from a user object.
 * @param {dict} user user object
 * @return {{[p: string]: any}}
 */
function relevantFields(user) {
    const exclude = ["passwordHash", "salt"]

    const entries = Object.entries(user);
    const filtered = entries.filter(([k, v]) => exclude.indexOf(k) === -1);

    return Object.fromEntries(filtered);
}

/**
 * Generate a reset token with encoded expiry time
 * @param {number} expiryHours - Hours until token expires (default: 1)
 * @returns {string} Token with encoded expiry
 */
function generateToken(expiryHours = 1) {
    const expiryTime = Date.now() + (expiryHours * 60 * 60 * 1000);
    const randomToken = crypto.randomBytes(24).toString("hex"); // 48 chars
    
    // Encode: timestamp + separator + random token, then base64 encode the whole thing
    const tokenData = `${expiryTime}:${randomToken}`;
    return Buffer.from(tokenData).toString('base64');
}

/**
 * Decode and validate a reset token with encoded expiry
 * @param {string} token - The encoded token
 * @returns {object} { isValid: boolean, expired: boolean, expiryTime: number }
 */
function decodeToken(token) {
    try {
        // Decode from base64
        const decoded = Buffer.from(token, 'base64').toString('utf8');
        const parts = decoded.split(':');
        
        if (parts.length !== 2) {
            return { isValid: false, expired: false, tokenPart: null, expiryTime: null };
        }
        
        const expiryTime = parseInt(parts[0], 10);
        const now = Date.now();
        
        // Check if timestamp is valid
        if (isNaN(expiryTime)) {
            return { isValid: false, expired: false, tokenPart: null, expiryTime: null };
        }
        
        // Check if token has expired
        const expired = now > expiryTime;
        
        return {
            isValid: true,
            expired: expired,
            expiryTime: expiryTime
        };
    } catch (error) {
        return { isValid: false, expired: false, expiryTime: null };
    }
}

function getFirstPresentValue(source, keys = []) {
    for (const key of keys) {
        const value = source?.[key];
        if (Array.isArray(value) && value.length > 0 && value[0]) {
            return value[0];
        }
        if (value) return value;
    }
    return null;
}

function getProvisionedNameParts({ firstName, lastName, email, fullName, fallbackFirstName, fallbackLastName }) {
    const normalizedFirstName = Array.isArray(firstName) ? firstName[0] : firstName;
    const normalizedLastName = Array.isArray(lastName) ? lastName[0] : lastName;
    const toDisplayNamePart = (value, fallback) => {
        if (!value) return fallback;
        return value.charAt(0).toUpperCase() + value.slice(1);
    };

    if (normalizedFirstName && normalizedLastName) {
        return { firstName: normalizedFirstName, lastName: normalizedLastName };
    }

    if (email) {
        const localPart = (email || '').split('@')[0] || '';
        const [rawFirstName, ...rest] = localPart.split('.').filter(Boolean);
        const rawLastName = rest.join('.');
        return {
            firstName: normalizedFirstName || toDisplayNamePart(rawFirstName, fallbackFirstName),
            lastName: normalizedLastName || toDisplayNamePart(rawLastName, fallbackLastName),
        };
    }

    const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
    return {
        firstName: normalizedFirstName || toDisplayNamePart(parts[0], fallbackFirstName),
        lastName: normalizedLastName || toDisplayNamePart(parts.slice(1).join(' '), fallbackLastName),
    };
}

async function findOrProvisionExternalUser(server, { externalField, externalValue, email, createData }) {
    let user = await server.db.models['user'].findOne({ where: { [externalField]: externalValue }, raw: true });

    if (!user && email) {
        user = await server.db.models['user'].findOne({ where: { email }, raw: true });
        if (user) {
            const updateData = { [externalField]: externalValue };
            if (email) updateData.email = email;
            await server.db.models['user'].update(updateData, { where: { id: user.id } });
            user = { ...user, ...updateData };
        }
    }

    if (user) return user;

    const transaction = await server.db.models['user'].sequelize.transaction();
    try {
        const createdUser = await server.db.models['user'].add({
            ...createData,
            [externalField]: externalValue,
            email: email || createData?.email || null,
        }, { transaction });
        await transaction.commit();
        return createdUser?.get ? createdUser.get({ plain: true }) : createdUser;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

function deriveUserSeed(seedInt, saltHex) {
    const seedBuf = Buffer.alloc(8);
    seedBuf.writeBigUInt64BE(BigInt(seedInt));

    const saltBuf = Buffer.from(saltHex, "hex");

    const hash = crypto
        .createHash("sha256")
        .update(seedBuf)
        .update(saltBuf)
        .digest();

    return hash.readUInt32BE(0); // uint32
}

module.exports = {
    genPwd,
    genSalt,
    genPwdHash,
    relevantFields,
    generateToken,
    decodeToken,
    findOrProvisionExternalUser,
    getFirstPresentValue,
    getProvisionedNameParts,
    deriveUserSeed
};
