const fs = require('fs');
const express = require('express');
const rateLimit = require('express-rate-limit');
const upload = require('express-fileupload');
const path = require('path');

const router = express.Router();

const PDF_PATH = `${__dirname}/../../../files/`;

router.get('/annotate/:pdf', (req, res, next) => {
    console.log(`${PDF_PATH}${req.params.pdf}.pdf`)

    // TODO: url still wrong
    res.render("annotate", {
        client_url: "http://localhost:5000",
        pdf_path: `/pdf/${req.params.pdf}`,
    })
  });

router.get('/pdf/:pdf', (req, res, next) => {

    // TODO: here we can implement some security feature
    // e.g., (that you can access only the pdf files which are assigned to you)
    console.log(`${PDF_PATH}${req.params.pdf}.pdf`)
    var data = fs.readFileSync(`${PDF_PATH}${req.params.pdf}.pdf`)
    var stat = fs.statSync(`${PDF_PATH}${req.params.pdf}.pdf`);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=quote.pdf');
    res.send(data);
  });

module.exports = router;