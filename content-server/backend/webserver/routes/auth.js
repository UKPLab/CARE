const express = require('express');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const crypto = require('crypto');
const pdb = require("../../tools/db.js")

const session = require('express-session');
const FileStore = require('session-file-store')(session);
const bodyParser = require('body-parser');


// Login
passport.use(new LocalStrategy(function verify(username, password, cb) {
    pdb.query('SELECT * FROM public."user" WHERE "user_name" = $1 OR "email" = $2', [ username, password ])
        .then((rows) => {
            if (!rows || rows.length !== 1) { return cb(null, false, { message: 'Incorrect username or password.' }); }

            crypto.pbkdf2(password, rows[0].salt, 310000, 32, 'sha256', function(err, hashedPassword) {
              if (err) { return cb(err); }

              if (!crypto.timingSafeEqual(Buffer.from(rows[0].password_hash, 'hex'), hashedPassword)) {
                return cb(null, false, { message: 'Incorrect username or password.' });
              }

              // filter row object, because not everything is the right information for website
                const relevantKeys = ['email', 'first_name', 'last_name', 'sys_role', 'user_name', 'uid'];
                const return_values = Object.keys(rows[0])
                    .filter((key) => relevantKeys.includes(key))
                    .reduce((obj, key) => {
                        obj[key] = rows[0][key];
                        return obj
                    }, {});
              return cb(null, return_values);
            });
        })
        .catch((err) => {
            return cb(err);
        })
}));

passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(user, done) {
    done(null, user);
});

module.exports = function(app) {

    // Session Initialization
    app.use(session({
        /*genid: (req) => {
            console.log('Inside session middleware genid function')
            console.log(`Request object sessionID from client: ${req.sessionID}`)
            return uuidv4(); // use UUIDs for session IDs
        },*/
        store: new FileStore(), //TODO store session data into database
        secret: 'thatsecretthinggoeshere',
        resave: false,
        saveUninitialized: true
    }));
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(bodyParser.json());
    app.use(passport.initialize());
    app.use(passport.session());

    app.post('/auth/login', function(req, res, next) {
        passport.authenticate('local', function(err, user, info) {
        if (err) { return res.status(500).send(err); } // TODO dont use 500 error code for missing or wrong credentials
        if (!user) { return res.status(401).send(info); }
        req.logIn(user, function(err) {
          if (err) { return next(err); }
           res.status(200).send({user:user});
        });
      })(req, res, next);
    });

    // Logout Procedure, no feedback needed since vuex also deletes the session
    app.get(
        '/auth/logout',
        function(req, res) {
            req.logout()
            req.session.destroy();
            res.status(200).send("Session destroyed!");
        }
    )

    app.get(
        '/auth/check',
        function(req, res) {
            if (req.user) {
                res.status(200).send({user:req.user});
            } else {
                res.status(401);
            }
            console.log(`req.session.passport: ${JSON.stringify(req.session.passport)}`);
            console.log(`req.user: ${JSON.stringify(req.user)}`);
        }
    );

    app.post(
        '/auth/register',
        function(req, res) {
            //TODO add user into database... data are in req.body
            console.log(req.body);
            //TODO return info for sucess or failure
        }
    );

};