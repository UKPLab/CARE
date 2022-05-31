/* pdf.js - Provides PDF files and pdf.js

Here the routes for loading PDFs from disc and for loading pdf.js are defined.

Author: Dennis Zyska (zyska@ukp.informatik....)
Source: --
*/

const fs = require('fs');
const express = require('express');
const connectEnsureLogin = require("connect-ensure-login");

const PDF_PATH = `${__dirname}/../../../files/`;
const PDFJS_PATH = `${__dirname}/../../../frameworks/pdf.js/build/generic`;

module.exports = function(app) {

    app.use("/pdf/*", connectEnsureLogin.ensureLoggedIn("/login"));

    app.use("/pdfjs", express.static(PDFJS_PATH));

    app.get('/pdf/:pdf', (req, res, next) => {
        const data = fs.readFileSync(`${PDF_PATH}${req.params.pdf}.pdf`);
        const stat = fs.statSync(`${PDF_PATH}${req.params.pdf}.pdf`);
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=quote.pdf');
        res.send(data);
    });

}
