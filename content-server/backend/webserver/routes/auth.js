const express = require('express');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const crypto = require('crypto');
const pgp = require('pg-promise')();

const router = express.Router();

const pdb = pgp({ //todo move to an own module
        host: process.env.POSTGRES_HOST,
        port: process.env.POSTGRES_PORT,
        database: process.env.POSTGRES_PEERDB,
        user: "postgres",
        password: ""
})

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

router.post('/auth/login', function(req, res, next) {
    passport.authenticate('local', function(err, user, info) {
    if (err) { return res.status(500).send(err); }
    if (!user) { return res.status(401).send(info); }
    req.logIn(user, function(err) {
      if (err) { return next(err); }
        //TODO send back session code, but where is it?
       res.status(200).send(user);
    });
  })(req, res, next);
});


passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(user, done) {
    done(null, user);
});


// Logout Procedure, no feedback needed since vuex also deletes the session
router.post(
    'auth/logout',
    function(req, res, next) {
        req.logout();
    }
)

module.exports = router;