/* init.js - Initialization Script for PEER and h Databases

Run this script (via node or through npm) to initialize the PEER and h database
with the basic necessary schema and entries. This script should be idempotent,
but we cannot guarantee that; i.e. there might be changes to the databases on
re-run.

__DISCLAIMER__: This script will be replaced in the near future through a proper
database management framework like alembic or similar.

Author: Nils Dycke (dycke@ukp.informatik...)
Co-Author: Dennis Zyska (zyska@ukp.informatik....)
Source: --
*/


const { ArgumentParser } = require('argparse');
const fs = require('fs');
const { pdb, hdb, addUser, addDoc } = require('./db.js');

// global parameters
const parser = new ArgumentParser({
  description: 'Initialize h and peer databases. Does not override existing entries and tables.'
});

parser.add_argument('--admin_name', { help: 'name of default admin. Considered as first name.' })
parser.add_argument('--admin_email', { help: 'email of default admin.' })
parser.add_argument('--admin_pwd', { help: 'password of admin' })

const args = parser.parse_args();

// hashing and passwords
const crypto = require('crypto');


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
    console.log("Initializing peer database");

    return pdb.connect()
        .then(async (res) => {
                return await config_peer_db();
            }
        )
        .catch(async (err) => {
                console.log("Peer database does not exist yet. Creating it.");

                await hdb.none(`CREATE DATABASE peer`);
                return await config_peer_db();
            }
        );
}

async function config_peer_db(){
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
            registered_at timestamp default now(),
            last_login_at timestamp,
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
            uid character varying(64) NOT NULL DEFAULT nextval('document_uid_seq'::regclass),
            name character varying(64) COLLATE pg_catalog."default",
            hash character varying(64) COLLATE pg_catalog."default" NOT NULL UNIQUE,
            hid integer NOT NULL,
            creator integer NOT NULL,
            created_at timestamp default now(),
            updated_at timestamp,
            deleted boolean,
            deleted_at timestamp,
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

    // add basic users
    await addUser(args.admin_name, "admin", "user", args.admin_email, "admin", "admin")
        .catch((err) => console.log("WARN: Failed to create admin -- probably already exists" + err));
    await addUser("guest", "guest", "user", "guest@email.com", "guestguest", "regular")
        .catch((err) => console.log("WARN: Failed to create guest -- probably already exists" + err));

    // create showcase document in DB
    const cuser = await pdb.query(`SELECT uid FROM public.user WHERE user_name = $1;`, ["guest"]);
    const cuid = cuser[0]["uid"];

    const sdoc = await pdb.query(`SELECT hash FROM public.document WHERE name = $1 and creator = $2;`, ["showcase", cuid]);
    var docid;
    if(sdoc.length === 0){
        docid = await addDoc("showcase", cuid);
    } else {
        console.log("Showcase document already exists in database");
        docid = sdoc[0]["hash"];
    }

    // create the showcase document in files (if necessary)
    const inPath = '../resources/showcase.pdf';
    const filesPath = '../files'
    const targetPath = `${filesPath}/${docid}.pdf`;
    console.log(`Loading showcase document from ${inPath} relative to ${process.cwd()}`);

    if(!fs.existsSync(filesPath)){
        console.log("Creating files directory...");
        fs.mkdirSync(filesPath);
    }

    if(!fs.existsSync(targetPath)){
        fs.copyFile(inPath, targetPath, (err) => {
          if (err) throw err;
          console.log('Copied showcase document');
        });
    } else {
        console.log("Showcase document already exists in files folder");
    }
}

init_h_db().then(r => {
    init_peer_db().then(r2 => {
        console.log("finished")
        process.exit()
    }).catch(err => {
        console.log("Could not initialize peer DB -- ABORTING");
        console.log(err);
    });
}).catch(err => {
   console.log("Could not initialize h DB -- ABORTING");
   console.log(err);
});