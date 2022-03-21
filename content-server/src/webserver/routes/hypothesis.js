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

router.get('/hypothesis', serveBootScript);
router.get(`/hypothesis/${version}`, serveBootScript)
router.use(`/hypothesis/${version}/`, express.static(`${HYPOTHESIS_CLIENT_PATH}/dev-server`))

module.exports = router;