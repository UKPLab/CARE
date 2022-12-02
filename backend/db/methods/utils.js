/* Helper functions for user management

Some helper functions

Author: Nils Dycke (dycke@ukp.informatik...), Dennis Zyska (zyska@ukp.informatik...)
*/
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

exports.InternalDatabaseError = function InternalDatabaseError(err) {
    return {
        name: "InternalDatabaseError",
        message: "Database not reachable or other internal database error. Details: " + err,
        toString: function () {
            return this.name + ": " + this.message;
        }
    };
}

exports.isInternalDatabaseError = function isInternalDatabaseError(seqErr) {
    const errors = ["SequelizeConnectionRefusedError"];

    return errors.indexOf(seqErr.name) !== -1;
}

exports.subselectFieldsForDB = function subselectFieldsForDB(obj, relevantFields) {
    return Object.fromEntries(Object.entries(obj).filter(([k, v]) => relevantFields.includes(k)));
}

// src: https://stackoverflow.com/questions/17781472/how-to-get-a-subset-of-a-javascript-objects-properties
exports.pickObjectAttributeSubset =  function pickObjectAttributeSubset(obj, keys) {
    return Object.fromEntries(keys.filter(key => key in obj).map(key => [key, obj[key]]));
}