const crypto = require("crypto");
const pgp = require('pg-promise')();

exports.pdb = pgp({
        host: process.env.POSTGRES_HOST,
        port: process.env.POSTGRES_PORT,
        database: process.env.POSTGRES_PEERDB,
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

exports.addUser = async function addUser(user_name, user_email, password, role, hid) {
    const salt = crypto.randomBytes(16).toString("hex");

    let derivedKey = await createPwd(password, salt);
    derivedKey = derivedKey.toString('hex');

    await exports.pdb.query(`
                INSERT INTO public."user" (hid, sys_role, first_name, last_name, user_name, email, password_hash, salt)
                VALUES ($1::integer,
                        $6::character varying,
                        $2::character varying,
                        'User'::character varying,
                        $2,
                        $3::character varying,
                        $4::character varying,
                        $5::character varying)`,
        [hid, user_name, user_email, derivedKey, salt, role]);
}