const fs = require('fs');
const express = require('express');
const rateLimit = require('express-rate-limit');
const upload = require('express-fileupload');
const path = require('path');

const router = express.Router();

const PDF_PATH = `${__dirname}/../../../files`;

router.post(
    '/api/upload',
    rateLimit({
      windowsMs: 15 * 60 * 1000, //timewindow for quota
      max: 15, //max requests per timewindow
    }),
    upload(),
    (req, res) => {

        //Make sure upload directory exists
        fs.mkdirSync(PDF_PATH, { recursive: true });

        if (req.files) {
            var file = req.files.file

            console.log("Uploading file: ", file.name)

            // Check file size
            if (file.size / 1000.0 > 3000) {
                console.warn('Too large file uploaded (max. 3Mb). Rejecting...');
                res.status(400).send('Too large file. Rejected!');
                return;
            }

            // Move file
            file.mv(path.join(PDF_PATH, "/" + file.name), function(err) {
                const filename = req.files.file.name.replace(/.pdf$/, '');
                  if (err) {
                      console.log('Something went wrong');
                      res.status(500);
                      res.send('Internal error during upload');
                  } else {
                      console.log('Uploading...');
                      res.send("uploaded!");
                  }
            });

        }
});

module.exports = router;