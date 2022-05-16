const { ArgumentParser } = require('argparse');
const dayjs = require('dayjs');
const { pdb, hdb, addUser } = require('./db.js');

// global parameters
const parser = new ArgumentParser({
  description: 'Initialize h and peer databases. Does not override existing entries and tables.'
});

parser.add_argument('--admin_name', { help: 'name of default admin. Considered as first name.' })
parser.add_argument('--admin_email', { help: 'email of default admin.' })
parser.add_argument('--admin_pwd', { help: 'password of admin' })

const args = parser.parse_args();

function init_h_db() {
    console.log("Initializing h database")
    console.log("Add admin user to h database...")
    let user_result = hdb.query(`
        INSERT INTO "user"
        (username, authority, "admin", email, password)
        VALUES
        ($1, 'localhost', true, $2, 'has_to_be_changed!') 
        ON CONFLICT DO NOTHING`,
        [process.env.H_SERVER_ADMIN_USER, process.env.H_SERVER_ADMIN_MAIL])
        //.then(data => console.log(data))

    console.log("Add oauth token to h database...")
    let oauth_result = hdb.query(`
        INSERT INTO authclient
        (id, "name", authority, grant_type, response_type, redirect_uri, trusted)
        VALUES
        ($1, 'API', 'localhost', 'authorization_code', 'code', $2, true)
        ON CONFLICT (id) 
            DO UPDATE SET redirect_uri = $2`,
        [process.env.CLIENT_OAUTH_ID, process.env.CLIENT_OAUTH_REDIRECT_URL])

    return Promise.resolve([user_result, oauth_result])
}

async function init_peer_db() {
    console.log("Initializing peer database")

    try {
        const connection = await pdb.connect()
    } catch(error) {
        console.log("Peer database does not exist yet. Creating it.")
        await hdb.none(`
            CREATE DATABASE peer
        `)
    }

    // create system roles table
    console.log("Creating system roles")
    await pdb.query(`
        CREATE TABLE IF NOT EXISTS public."sys-role" (
            name character varying(10) COLLATE pg_catalog."default" NOT NULL,
            description character varying(50) COLLATE pg_catalog."default" NOT NULL,
            CONSTRAINT "sys-role_pkey" PRIMARY KEY (name)
        ) WITH (OIDS = FALSE);
        
        ALTER TABLE IF EXISTS public."sys-role"
            OWNER to postgres;
    `);

    // create user sequence and table
    console.log("Creating user table")
    await pdb.query(`
        CREATE SEQUENCE IF NOT EXISTS public.user_uid_seq;
        
        ALTER SEQUENCE public.user_uid_seq
            OWNER TO postgres;
    `);

    await pdb.query(`
        CREATE TABLE IF NOT EXISTS public."user" (
            uid integer NOT NULL DEFAULT nextval('user_uid_seq'::regclass),
            hid integer NOT NULL,
            sys_role character varying(10) NOT NULL,
            first_name character varying(50) COLLATE pg_catalog."default" NOT NULL,
            last_name character varying(50) COLLATE pg_catalog."default" NOT NULL,
            user_name character varying(50) COLLATE pg_catalog."default" NOT NULL UNIQUE,
            email character varying(100) COLLATE pg_catalog."default" NOT NULL UNIQUE,
            password_hash character varying(64) COLLATE pg_catalog."default",
            salt character varying(32) COLLATE pg_catalog."default",
            registered_at time with time zone,
            last_login_at time with time zone,
            CONSTRAINT user_pkey PRIMARY KEY (uid),
            CONSTRAINT email UNIQUE (email),
            CONSTRAINT role FOREIGN KEY (sys_role)
                REFERENCES public."sys-role" (name) MATCH SIMPLE
                ON UPDATE NO ACTION
                ON DELETE NO ACTION
        )
        WITH (
            OIDS = FALSE
        )
        TABLESPACE pg_default;
        
        ALTER TABLE IF EXISTS public."user"
            OWNER to postgres;
    `);

    // create document sequence and table
    console.log("Creating document table")
    await pdb.query(`
        CREATE SEQUENCE IF NOT EXISTS public.document_uid_seq;
        
        ALTER SEQUENCE public.document_uid_seq
            OWNER TO postgres;
    `);

    await pdb.query(`
        CREATE TABLE IF NOT EXISTS public.document (
            uid integer NOT NULL DEFAULT nextval('document_uid_seq'::regclass),
            name character varying(64) COLLATE pg_catalog."default",
            hash character varying(64) COLLATE pg_catalog."default" NOT NULL,
            hid integer NOT NULL,
            creator integer NOT NULL,
            created_at time with time zone,
            updated_at time with time zone,
            deleted boolean,
            deleted_at time with time zone,
            CONSTRAINT document_pkey PRIMARY KEY (uid),
            CONSTRAINT creator FOREIGN KEY (creator)
                REFERENCES public."user" (uid) MATCH SIMPLE
                ON UPDATE NO ACTION
                ON DELETE NO ACTION
        )
        WITH (
            OIDS = FALSE
        )
        TABLESPACE pg_default;
        
        ALTER TABLE IF EXISTS public.document
            OWNER to postgres;
    `);

    // create basic system roles, if not existent
    console.log("Creating minimal user set")
    const roles = [["regular", "no system rights"],
                   ["maintainer","manage users"],
                   ["admin", "full control"]]

    for(const role of roles) {
        await pdb.query(`
            INSERT INTO public."sys-role" (name, description) 
            VALUES ($1::character varying, $2::character varying) 
            ON CONFLICT DO NOTHING;
        `, role);
    }

    //create admin + guest user, if not existent
    async function createPwd(password, salt) {
        return new Promise((res, rej) => {
            crypto.pbkdf2(password, salt, 310000, 32, 'sha256', (err, derivedKey) => {
                err ? rej(err) : res(derivedKey);
            });
        });
    }

    async function addUser(user_name, user_email, password, role, hid) {
        console.log(`Creating user ${user_name}`);

        const salt = crypto.randomBytes(16).toString("hex");

        let derivedKey = await createPwd(password, salt);
        derivedKey = derivedKey.toString('hex');

        await pdb.query(`
                    INSERT INTO public."user" (hid, sys_role, first_name, last_name, user_name, email, password_hash, salt)
                    VALUES ($1::integer,
                            $6::character varying,
                            $2::character varying,
                            'User'::character varying,
                            $2,
                            $3::character varying,
                            $4::character varying,
                            $5::character varying)
                    ON CONFLICT DO NOTHING;`,
            [hid, user_name, user_email, derivedKey, salt, role]);
    }

    await addUser(args.admin_name, args.admin_email, "admin", "admin", "1");
    await addUser("guest", "guest@email.com", "guestguest", "regular", "2");


    async function addDoc(doc_name, hid, creator) {
        console.log(`Creating document ${doc_name}`);

        // todo add salt if we want to make it more secure (against guessing)
        //const salt = crypto.randomBytes(16).toString("hex");

        const cuser = await pdb.query(`SELECT uid FROM public.user WHERE user_name = $1;`, [creator]);
        let cuid;

        if(cuser.length !== 1){
           throw Error(creator + " does not exist. Cannot create document in their name.");
        } else {
           cuid = cuser[0]["uid"];
        }
        const doc_id = await pdb.query(`SELECT last_value FROM public.document_uid_seq;`);
        const hash = crypto.createHash("sha256").update(doc_id + doc_name).digest("hex");

        const now = "2022-05-12 13:51:14.999394 +00:00"; //TODO do with dayjs().format();
        await pdb.query(`
                    INSERT INTO public."document" (name, hash, hid, creator, created_at, deleted)
                    VALUES ($1::character varying,
                            $2::character varying,
                            $3::integer,
                            $4::integer,
                            $5::time with time zone,
                            $6::boolean)
                    ON CONFLICT DO NOTHING;`,
            [doc_name, hash, hid, cuid, now, false]);
    }

    await addDoc("showcase", 0, "guest");
    addUser(args.admin_name, args.admin_email, "admin", "admin", "1")
        .catch((err) => {
            console.log(err);
        })
    addUser("guest", "guest@email.com", "guestguest", "regular", "2")
        .catch((err) => {
            console.log(err);
        })
}

init_h_db().then(r =>
    init_peer_db().then(r2 => {
        console.log("finished")
        process.exit()
    })
)