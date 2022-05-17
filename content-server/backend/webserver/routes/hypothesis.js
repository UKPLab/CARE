/* structure mainly from /frameworks/hypothesis/client/dev-server/serve-package.js */

const fs = require('fs');
const express = require('express');
const rateLimit = require('express-rate-limit');
const upload = require('express-fileupload');
const path = require('path');
const autologin = require('../../tools/autologin');


const HYPOTHESIS_CLIENT_PATH = `${__dirname}/../../../frameworks/hypothesis/client`;
const { version } = require(`${HYPOTHESIS_CLIENT_PATH}/package.json`)

const serveBootScript = function (req, res) {
    const entryPath = require.resolve(HYPOTHESIS_CLIENT_PATH);
    const entryScript = fs.readFileSync(entryPath).toString('utf-8');
    res.append('Content-Type', 'application/javascript; charset=utf-8');
    res.send(entryScript);
};

module.exports = function(app) {

    // Enable CORS for assets so that cross-origin font loading works.
    app.use((req, res, next) => {
        res.append('Access-Control-Allow-Origin', '*');
        res.append('Access-Control-Allow-Methods', 'GET');
        next();
    });

    app.get('/hypothesis', serveBootScript);
    app.get(`/hypothesis/${version}`, serveBootScript);
    app.use(`/hypothesis/${version}/build/`, express.static(`${HYPOTHESIS_CLIENT_PATH}/build`));
    app.use(`/hypothesis/build/`, express.static(`${HYPOTHESIS_CLIENT_PATH}/build`));

    // Loading app.html
    app.get('/app.html', async (req, res) => {

        // Hypothesis Autologin
        if (!('login_data' in req.session)) {
            req.session['login_data'] = await autologin(req);
            req.session.save();
        }

        // TODO try catch for error during login process (what should then be displayed in frontend)?
        // TODO login process can sometimes take some seconds, what should be displayed then?)

        //set Cookies
        res.cookie(req.session['login_data'].sessionCookie.name,
            req.session['login_data'].sessionCookie.cookie,
            req.session['login_data'].sessionCookie.options);
        res.cookie(req.session['login_data'].authCookie.name,
            req.session['login_data'].authCookie.cookie,
            req.session['login_data'].authCookie.options);
        res.render('sidebar', {oauth: JSON.stringify(req.session['login_data'].oauth)});

    });

}
