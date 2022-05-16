const fs = require('fs');
const express = require('express');
const rateLimit = require('express-rate-limit');
const upload = require('express-fileupload');
const path = require('path');

const {addDoc} = require('../../tools/db.js');


const PDF_PATH = `${__dirname}/../../../files`;

module.exports = function(app) {
    //TODO add check for login

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
                                console.log('Something went wrong');
                                //TODO clean-up database

                                res.status(500);
                                res.send('Internal error during upload');
                            } else {
                                console.log('Uploading...');
                                res.send({id: pdf_id});
                            }
                        });
                    })
                    .catch((err) => res.status(501).send("Failed to add document to database." + err.toString()))
            } else {
                res.status(400).send("Expected a file to be passed to this end-point");
            }
        });

}