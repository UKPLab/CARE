const crypto = require('crypto');
const pgp = require('pg-promise')();


exports.pdb = pgp({
        host: process.env.POSTGRES_HOST,
        port: process.env.POSTGRES_PORT,
        database: process.env.POSTGRES_PEERDB,
        user: "postgres",
        password: ""
})

// h database connector
exports.hdb = pgp({
        host: process.env.POSTGRES_HOST,
        port: process.env.POSTGRES_PORT,
        database: "postgres",
        user: "postgres",
        password: ""
})

//create admin + guest user, if not existent
async function createPwd(password, salt) {
    return new Promise((res, rej) => {
        crypto.pbkdf2(password, salt, 310000, 32, 'sha256', (err, derivedKey) => {
            err ? rej(err) : res(derivedKey);
        });
    });
}

exports.addUser = async function addUser(user_name, user_email, password, role) {
    const salt = crypto.randomBytes(16).toString("hex");

    let derivedKey = await createPwd(password, salt);
    derivedKey = derivedKey.toString('hex');

    await exports.pdb.query(`
                INSERT INTO public."user" (hid, sys_role, first_name, last_name, user_name, email, password_hash, salt)
                VALUES (0,
                        $5::character varying,
                        $1::character varying,
                        'User'::character varying,
                        $1,
                        $2::character varying,
                        $3::character varying,
                        $4::character varying)`,
        [user_name, user_email, derivedKey, salt, role]);
}