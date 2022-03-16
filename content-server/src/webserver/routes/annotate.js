const fs = require('fs');
const express = require('express');
const rateLimit = require('express-rate-limit');
const upload = require('express-fileupload');
const path = require('path');

const router = express.Router();

const PDF_PATH = `${__dirname}/../../../files/`;

router.get('/annotate/:pdf', (req, res, next) => {
    console.log(`${PDF_PATH}${req.params.pdf}.pdf`)

    res.render("annotate", {

    })
  });

module.exports = router;