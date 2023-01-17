/* auth.js - Routes for login

Here the routes for login into the content server are provided. This includes checking of tokens and
register, login and logout.

Author: Nils Dycke (dycke@ukp.informatik...), Dennis Zyska (zyska@ukp.informatik....)
Co-Author: -
Source: Inspired by https://heynode.com/tutorial/authenticate-users-node-expressjs-and-passportjs/
*/

const passport = require('passport');
const LocalStrategy = require('passport-local');
const crypto = require('crypto');
const {add: addUser, find: findUser, relevantFields: getUserFields} = require('../../db/methods/user.js')
const logger = require("../../utils/logger.js")("routes/auth");

// internal login procedure using passport and postgres
passport.use(new LocalStrategy(function verify(username, password, cb) {
    findUser(username, password)
        .then(rows => {
            if (!rows || rows.length !== 1) {
                return cb(null, false, {message: 'Incorrect username or password.'});
            }

            crypto.pbkdf2(password, rows[0].salt, 310000, 32, 'sha256', function (err, hashedPassword) {
                if (err) {
                    return cb(err);
                }

                if (!crypto.timingSafeEqual(Buffer.from(rows[0].passwordHash, 'hex'), hashedPassword)) {
                    return cb(null, false, {message: 'Incorrect username or password.'});
                }

                // filter row object, because not everything is the right information for website
                return cb(null, getUserFields(rows[0]));
            });
        })
        .catch(err => {
            return cb(err);
        });
}));

// required to work -- defines strategy for storing user information
passport.serializeUser(function (user, done) {
    done(null, user);
});

// required to work -- defines strategy for loading user information
passport.deserializeUser(function (user, done) {
    done(null, user);
});

// register
async function register(user_credentials, res) {
    const user_name = user_credentials["user_name"];
    const email = user_credentials["email"];
    const first_name = user_credentials["first_name"];
    const last_name = user_credentials["last_name"];
    const pwd = user_credentials["password"];
    const agree = user_credentials["terms"];
    const stats = user_credentials["stats"];

    if (!user_name || !email || !first_name || !last_name || !pwd || !agree) {
        res.status(400).send("All credential fields need to be provided");
    } else {
        addUser(user_name, first_name, last_name, email, pwd, "regular", agree, stats)
            .then((success) => {
                res.status(201).send("User was successfully created");
            })
            .catch((err) => {
                logger.info("Cannot create user: " + err);

                if (err.name === "DuplicateUserException") {
                    res.status(400).send("User already exists");
                } else if (err.name === "InvalidPasswordException") {
                    res.status(400).send(err.message);
                } else {
                    res.status(400).send("Unknown error occurred. Consult admins");
                }
            });
    }
}

module.exports = function (app) {
    // user login
    app.post('/auth/login', function (req, res, next) {
        passport.authenticate('local', function (err, user, info) {
            if (err) {
                logger.info("Login failed: " + err);
                return res.status(500).send("Failed to login");
            }
            if (!user) {
                return res.status(401).send(info);
            }
            req.logIn(user, function (err) {
                if (err) {
                    return next(err);
                }
                res.status(200).send({user: user});
            });
        })(req, res, next);
    });

    // Logout Procedure, no feedback needed since vuex also deletes the session
    app.get('/auth/logout', function (req, res) {
        req.logout(function (err) {
            if (err) {
                return next(err);
            }
            req.session.destroy();
            res.clearCookie('connect.sid');
            return res.status(200).send("Session destroyed!");
        });
    })

    // check whether user is logged in
    app.get('/auth/check', function (req, res) {
        if (req.user) {
            res.status(200).send({user: req.user});
        } else {
            res.status(401);
        }
        logger.debug(`req.session.passport: ${JSON.stringify(req.session.passport)}`);
        logger.debug(`req.user: ${JSON.stringify(req.user)}`);
    });

    // register a user
    app.post('/auth/register', function (req, res) {
        register(req.body, res);
    });
};