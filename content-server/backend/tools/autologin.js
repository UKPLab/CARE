const axios = require('axios');
const { hdb } = require('./db.js');
const extractCookie = require('./extractCookie');
const oauth = require('axios-oauth-client');
const FormData = require('form-data');

const hypothesis_server = process.env.APP_URL

module.exports = function(req) {

    // Check user exists?
    if (req.user['hid'] === 0) {
        // add user to database
        const password_h_database = "$2b$12$sfosfvs/XJVmWjhWfk4gXumQX4yDzE7FKeuvr7uFiPIcFb8VsP.p2";
        //create user in h database
        hdb.query(`
                    INSERT INTO public."user" (username, authority, display_name, "admin", email, "password")
                    VALUES ($1::character varying,
                            'localhost',
                            $2::character varying,
                            false,
                            $3::character varying,
                            $4::character varying)`,
            [req.user['user_name'], req.user['first_name'] + ' ' +  req.user['last_name'], req.user['email'], password_h_database])
            .then(r => {
                hdb.query(`SELECT id FROM public."user" WHERE username = $1`, [req.user['user_name']]).then(row => {
                    console.log(row);
                    req.user['hid'] = row[0].id;
                    req.session.save();
                })
                console.log('New user created!');
        });
    }

    return axios.get(`${hypothesis_server}/login`, {withCredentials: true}).then(result => {
        let csrf_token = result.data.match('<input(?:.*?)name=\"csrf_token\"(?:.*)value=\"([^"]+).*>')[1];

        let loginData = new FormData();
        loginData.append('__formid__', 'deform');
        loginData.append('username', req.user['user_name']);
        loginData.append('password', ">e&s'W%j<L-ZNd:qPg27");
        loginData.append('Log_in', "Log_in");
        loginData.append("csrf_token", csrf_token);

        const sessionCookie = extractCookie(result.headers['set-cookie'][0]);

        return axios.post(`${hypothesis_server}/login`, loginData, {
            withCredentials: true,
            maxRedirects: 0,
            validateStatus: function (status) {
                return status >= 200 && status <= 302; //accept also 302
            },
            headers: {
                'Content-Type': `multipart/form-data; boundary=${loginData._boundary}`,
                'Cookie': `session=${sessionCookie['session']}`,
            }
        }).then(login_result => {
            const authCookie = extractCookie(login_result.headers['set-cookie'][0]);
            const sessionCookie = extractCookie(login_result.headers['set-cookie'][1]);

            return axios.get(
                `${hypothesis_server}/oauth/authorize?client_id=${process.env.CLIENT_OAUTH_ID}&response_type=code`,
                {
                    maxRedirects: 0,
                    validateStatus: function (status) {
                        return status >= 200 && status <= 302; //accept also 302
                    },
                    headers: {
                        'Cookie': `session=${sessionCookie['session']};auth=${authCookie['auth']}`,
                    }
                }).then(async oauth_auth_result => {
                const code = oauth_auth_result.headers.location.match('code=(.*)')[1];

                const getAuthorizationCode = oauth.client(axios.create({
                    withCredentials: true,
                    headers: {
                        'Cookie': `auth=${authCookie['auth']}`,
                    }
                }), {
                    url: `${hypothesis_server}/api/token`,
                    grant_type: 'authorization_code',
                    client_id: 'a2556958-a9cc-11ec-a061-17298d8dd357',
                    code: code,
                })

                const auth = await getAuthorizationCode();

                return {
                    oauth: {
                        accessToken: auth['access_token'],
                        expiresAt: Date.now() + auth['expires_in'],
                        refreshToken: auth['refresh_token']
                    },
                    sessionCookie: {
                        name: 'session',
                        cookie: sessionCookie['session'],
                        options: {
                            domain: "localhost",
                            path: "/",
                            httpOnly: true,
                            sameSite: "Lax",
                            secure: process.env.NODE_ENV === 'production'
                        }
                    },
                    authCookie: {
                        name: 'auth',
                        cookie: authCookie['auth'],
                        options: {
                            domain: "localhost",
                            path: "/",
                            httpOnly: true,
                            secure: process.env.NODE_ENV === 'production'
                        }
                    }
                }
            });
        });
    });
}


