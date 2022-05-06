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

passport.use(new LocalStrategy(function verify(username, password, cb) {
    console.log(username);
    console.log(password);

    //return cb(null, false, {message: "incorrect username or password"});

    pdb.query('SELECT * FROM public."user" WHERE "user_name" = $1 OR "email" = $2', [ username, password ])
        .then((rows) => {
            if (!rows || rows.length !== 1) { return cb(null, false, { message: 'Incorrect username or password.' }); }

            const row = rows[0];

            crypto.pbkdf2(password, Buffer.from(row.salt, "hex"), 310000, 32, 'sha256', function(err, hashedPassword) {
              if (err) { return cb(err); }

              console.log(hashedPassword);
              console.log(Buffer.from(row.password_hash, 'hex'));

              if (!crypto.timingSafeEqual(Buffer.from(row.password_hash, 'hex'), hashedPassword)) {
                return cb(null, false, { message: 'Incorrect username or password.' });
              }
              return cb(null, row);
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


router.post(
    '/auth/guest_login',
    function(req, res, next){
        console.log("LOGIN REQUEST ON GUEST");

        passport.authenticate('local', {
            successRedirect: "/",
            failureRedirect: '/login'
        })(req, res, next);
    }
);

module.exports = router;

// TODO add session
// https://passportjs.org/tutorials/password/session