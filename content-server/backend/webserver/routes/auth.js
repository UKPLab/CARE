const express = require('express');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const crypto = require('crypto');

const router = express.Router();


passport.use(new LocalStrategy(function verify(username, password, cb) {
    // see https://passportjs.org/tutorials/password/verify/
    return cb(null, null);
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