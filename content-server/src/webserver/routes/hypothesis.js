/* structure mainly from /frameworks/hypothesis/client/dev-server/serve-package.js */

const fs = require('fs');
const express = require('express');
const rateLimit = require('express-rate-limit');
const upload = require('express-fileupload');
const path = require('path');


const router = express.Router();

const HYPOTHESIS_CLIENT_PATH = `${__dirname}/../../../frameworks/hypothesis/client`;
const { version } = require(`${HYPOTHESIS_CLIENT_PATH}/package.json`)

const serveBootScript = function (req, res) {
    const entryPath = require.resolve(HYPOTHESIS_CLIENT_PATH);
    const entryScript = fs.readFileSync(entryPath).toString('utf-8');
    res.append('Content-Type', 'application/javascript; charset=utf-8');
    res.send(entryScript);
};

// Enable CORS for assets so that cross-origin font loading works.
router.use((req, res, next) => {
    res.append('Access-Control-Allow-Origin', '*');
    res.append('Access-Control-Allow-Methods', 'GET');
    next();
  });

router.get('/hypothesis', serveBootScript);
router.get(`/hypothesis/${version}`, serveBootScript);
router.use(`/hypothesis/${version}/build/`, express.static(`${HYPOTHESIS_CLIENT_PATH}/build`));
router.use(`/hypothesis/build/`, express.static(`${HYPOTHESIS_CLIENT_PATH}/build`));

// Loading app.html
router.get('/app.html', (req, res) => {
    res.render('sidebar');
});


module.exports = router;