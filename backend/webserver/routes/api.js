const fs = require('fs');
const express = require('express');
const rateLimit = require('express-rate-limit');
const upload = require('express-fileupload');
const path = require('path');

const {addDoc, deleteDoc, renameDoc} = require('../../tools/db.js');
const connectEnsureLogin = require("connect-ensure-login");
const {pdb} = require("../../tools/db");


const PDF_PATH = `${__dirname}/../../../files`;

module.exports = function(app) {
    app.use("/api/*", connectEnsureLogin.ensureLoggedIn("/login"));

    app.get('/api/docs', function(req, res) {
        res.setHeader('Content-Type', 'application/json');

        pdb.query('SELECT * FROM public."document" WHERE "creator" = $1 and "deleted" = False', [ req.user.uid ])
            .then((rows) => {
                if (!rows) {
                    return res.status(200).end(JSON.stringify({"docs": [], "status": "FAIL"}));
                }

                return res.status(200).end(JSON.stringify({"docs": rows, "status": "OK"}));
            })
            .catch((err) => {
                return res.status(401).end(JSON.stringify({"docs": [], "status": "FAIL"}));
            });
    });

    app.post(
        '/api/upload',
        rateLimit({
            windowsMs: 15 * 60 * 1000, //timewindow for quota
            max: 15, //max requests per timewindow
        }),
        upload(),
        (req, res) => {
            //Make sure upload directory exists
            fs.mkdirSync(PDF_PATH, {recursive: true});

            if (req.files) {
                var file = req.files.file

                console.log("Uploading file: ", file.name)

                // Check file size
                if (file.size / 1000.0 > 10000) {
                    console.warn('Too large file uploaded (max. 10Mb). Rejecting...');
                    res.status(400).send('Too large file. Rejected!');
                }

                // Add document to database
                const name = req.files.file.name.replace(/.pdf$/, '');
                addDoc(name, req.user.uid)
                    .then((pdf_id) => {
                        const target = path.join(PDF_PATH, `${pdf_id}.pdf`);

                        // Move file
                        file.mv(target, function (err) {
                            if (err) {
                                res.status(500);
                                res.send('Internal error during upload');
                            } else {
                                res.send({id: pdf_id});
                            }
                        });
                    })
                    .catch((err) => res.status(501).send("Failed to add document to database." + err.toString()))
            } else {
                res.status(400).send("Expected a file to be passed to this end-point");
            }
        });

    app.post('/api/delete', (req, res) => {
        deleteDoc(req.body.docId)
            .then((out) => res.status(200).send("Document deleted"))
            .catch((err) => res.status(400).send("Failed to delete"));
    });

    app.post('/api/rename', (req, res) => {
        renameDoc(req.body.docId, req.body.newName)
            .then((out) => res.status(200).send("Document deleted"))
            .catch((err) => res.status(400).send("Failed to delete"));
    });
}