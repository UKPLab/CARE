"use strict";

/**
 * Dedicated, swappable PDF text extraction helper.
 *
 * Isolated in its own module so the underlying library (currently `pdf-parse`) can be replaced
 * later without touching any callers.
 *
 * @module utils/pdfText
 */

const { PDFParse } = require("pdf-parse");

/**
 * Extracts plain text from a PDF file buffer.
 *
 * @param {Buffer} buffer Raw PDF bytes.
 * @returns {Promise<string>} Extracted plain text, or an empty string if none could be read.
 */
async function extractPdfText(buffer) {
     const parser = new PDFParse({ data: buffer });
    try {
        const result = await parser.getText();
        return result && typeof result.text === "string" ? result.text : "";
    } finally {
        await parser.destroy();
    }

}

module.exports = { extractPdfText };
