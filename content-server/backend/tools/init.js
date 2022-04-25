const pgp = require('pg-promise')();
const db = pgp('postgres://postgres:@localhost:5432/postgres');

function init() {

    console.log("Add admin user to database...")
    let user_result = db.query(`
        INSERT INTO "user"
        (username, authority, "admin", email, password)
        VALUES
        ($1, 'localhost', true, $2, 'has_to_be_changed!') 
        ON CONFLICT DO NOTHING`,
        [process.env.H_SERVER_ADMIN_USER, process.env.H_SERVER_ADMIN_MAIL])
        //.then(data => console.log(data))

    console.log("Add oauth token to database...")
    let oauth_result = db.query(`
        INSERT INTO authclient
        (id, "name", authority, grant_type, response_type, redirect_uri, trusted)
        VALUES
        ($1, 'API', 'localhost', 'authorization_code', 'code', $2, true)
        ON CONFLICT (id) 
            DO UPDATE SET redirect_uri = $2`,
        [process.env.CLIENT_OAUTH_ID, process.env.CLIENT_OAUTH_REDIRECT_URL])

    return Promise.resolve([user_result, oauth_result])

}

init()

/*module.exports = init;*/
