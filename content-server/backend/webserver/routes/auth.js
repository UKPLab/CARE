const express = require('express');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const crypto = require('crypto');
const pgp = require('pg-promise')();

const router = express.Router();

const pdb = pgp({
        host: process.env.POSTGRES_HOST,
        port: process.env.POSTGRES_PORT,
        database: process.env.POSTGRES_PEERDB,
        user: "postgres",
        password: ""
})

passport.use(new LocalStrategy(function verify(username, password, cb) {
    console.log(username);
    console.log(password);

  pdb.get('SELECT * FROM "user" WHERE user_name = ? OR email = ?', [ username, username ], function(err, row) {
      console.log(row);
    if (err) { return cb(err); }
    if (!row) { return cb(null, false, { message: 'Incorrect username or password.' }); }

    crypto.pbkdf2(password, row.salt, 310000, 32, 'sha256', function(err, hashedPassword) {
      if (err) { return cb(err); }
      if (!crypto.timingSafeEqual(Buffer.from(row.password_hash, 'hex'), hashedPassword)) {
        return cb(null, false, { message: 'Incorrect username or password.' });
      }
      return cb(null, row);
    });
  });
}));


router.post(
    '/auth/guest_login',
    passport.authenticate('local', {
        successRedirect: "/",
        failureRedirect: '/login',
    })

);

module.exports = router;

// TODO add session
// https://passportjs.org/tutorials/password/session