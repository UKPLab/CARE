const crypto = require("crypto");
const dayjs = require("dayjs");
const pgp = require('pg-promise')();
const { v4: uuidv4 } = require('uuid');

const DOC_URI = process.env.VITE_APP_WEBSOCKET_URL + "/annotate/"

const pdb = pgp({
        host: process.env.POSTGRES_HOST,
        port: process.env.POSTGRES_PORT,
        database: process.env.POSTGRES_PEERDB,
        user: "postgres",
        password: ""
});
exports.pdb = pdb;

// h database connector
const hdb = pgp({
        host: process.env.POSTGRES_HOST,
        port: process.env.POSTGRES_PORT,
        database: "postgres",
        user: "postgres",
        password: ""
});
exports.hdb = hdb;


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

    await pdb.query(`
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

exports.addDoc = async function addDoc(doc_name, creator_id) {
    // create unique document id
    var hash;
    while(true){
        hash = uuidv4();

        const duplicate = await pdb.query(`SELECT * FROM public.document WHERE hash = $1;`, [hash]);
        if(duplicate.length == 0){
            break;
        }
    }

    // get hid
    const last_docid = await hdb.query(`SELECT last_value::integer FROM document_id_seq;`);
    if(!last_docid || last_docid.length !== 1){
        throw Error("Could not created document in h database. Lacks initialization?");
    }
    const hid = last_docid[0].last_value +1;

    // create document in peer DB
    await pdb.query(`
                INSERT INTO public."document" (name, hash, hid, creator, deleted)
                VALUES ($1::character varying,
                        $2::character varying,
                        $3::integer,
                        $4::integer,
                        false::boolean);`,
        [doc_name, hash, hid, creator_id]);

    // create document in h DB
    const uri = DOC_URI + hash;
    await hdb.query(`
                INSERT INTO public."document" (title, web_uri)
                VALUES ($1::text,
                        $2::text);`,
        [doc_name, uri]);

    return hash;
}

exports.deleteDoc = async function deleteDoc(doc_id) {
    console.log("Deleting " + doc_id);

    // set date
    const now = dayjs().format("YYYY-MM-DD HH:mm:ss.SSS Z");

    // check for document in peer DB
    const docs = await pdb.query(`SELECT * FROM public."document" WHERE uid = $1`, [doc_id]);
    if(!docs || docs.length !== 1){
        throw Error("Document not found in database.");
    }
    const doc = docs[0];

    // set delete flag in database
    await pdb.query(`UPDATE peer.public.document 
                        SET deleted = true
                        WHERE uid = $1;`,
        [doc_id]);
}

exports.renameDoc = async function renameDoc(doc_id, new_name) {
    console.log("Renaming " + doc_id);

    // set date
    const now = dayjs().format("YYYY-MM-DD HH:mm:ss.SSS Z");

    // check for document in peer DB
    const docs = await pdb.query(`SELECT * FROM public."document" WHERE uid = $1`, [doc_id]);
    if(!docs || docs.length !== 1){
        throw Error("Document not found in database.");
    }
    const doc = docs[0];

    // set delete flag in database
    await pdb.query(`UPDATE peer.public.document 
                        SET name = $2
                        WHERE uid = $1;`,
        [doc_id, new_name]);
}