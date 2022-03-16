const fs = require('fs');
const express = require('express');
const rateLimit = require('express-rate-limit');
const upload = require('express-fileupload');
const path = require('path');

const router = express.Router();

const PDF_PATH = `${__dirname}/../../../files/`;

router.get('/annotate/:pdf', (req, res, next) => {
    console.log(`${PDF_PATH}${req.params.pdf}.pdf`)

    if (fs.existsSync(`${PDF_PATH}${req.params.pdf}.pdf`)) {
      const relativeSourceUrl = `/pdf-source/${req.params.pdf}.pdf`;
      const fullUrl = `${req.protocol}://${req.hostname}:${port}${req.originalUrl}`;
      const context = templateContext(config);

      res.render('pdfjs-viewer', {
        ...context,
        clientUrl: config.clientUrl, // URL to embed source
        documentUrl: fullUrl, // The URL that annotations are associated with
        url: relativeSourceUrl, // The URL for the PDF source file
      });
    } else {
      next();
    }
  });


module.exports = router;