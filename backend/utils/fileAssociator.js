/*
 * backend/utils/fileAssociator.js
 * --------------------------------------------------
 * Utility helper that tries to pair PDF and ZIP files that belong together
 * inside one Moodle submission.
 *
 * It receives two **arrays** – pdfFiles and zipFiles – where each element
 * is the exact object coming from Moodle-API (see utils/moodleAPI/Moodle.py: filename,
 * fileurl, mimetype, timemodified …).  The algorithm is intentionally
 * heuristic so it can handle imperfect situations (missing counterpart,
 * different timestamps, inconsistent filenames).
 *
 * Returned object
 *  {
 *      pairs: [ { pdf: <file>, zip: <file>, confidence: 0-100, method: <string> } ],
 *      unpairedPdfs: [<file>, …],
 *      unpairedZips: [<file>, …],
 *      warnings: [<string>, …]
 *  }
 * 
 * @author Yiwei Wang
 * @type {FileAssociator}
 */

const path = require("path");

function baseName(file) {
    // strip extension + lower-case for safe compare
    return file.filename ? file.filename.replace(/\.[^/.]+$/, "").toLowerCase() : "";
}

function timeDiff(a, b) {
    return Math.abs(Number(a.timemodified || 0) - Number(b.timemodified || 0));
}

/**
 * Associate pdf and zip files for one submission.
 *
 * Heuristics (in this order):
 * 1. If there is exactly ONE pdf and ONE zip → pair (confidence 100).
 * 2. Base-name match (filename without extension) → pair (confidence 90).
 * 3. Closest timestamp within threshold (default 3 min) → pair (confidence 60).
 * 4. Anything remaining stays unpaired – caller can ask the admin.
 *
 * @param {Array<Object>} pdfFiles   – list of pdf file-objects
 * @param {Array<Object>} zipFiles   – list of zip file-objects
 * @param {Object}   [opts]
 * @param {number}   [opts.timeThreshold=180] – seconds allowed for timestamp pairing
 */
function associateFilesForSubmission(pdfFiles = [], zipFiles = [], opts = {}) {
    const timeThreshold = opts.timeThreshold || 180; // seconds

    // defensive copies
    const pdfLeft  = [...pdfFiles];
    const zipLeft  = [...zipFiles];
    const pairs    = [];
    const warnings = [];

    // 1. trivial 1-to-1 case
    if (pdfLeft.length === 1 && zipLeft.length === 1) {
        pairs.push({ pdf: pdfLeft[0], zip: zipLeft[0], confidence: 100, method: "single" });
        return { pairs, unpairedPdfs: [], unpairedZips: [], warnings };
    }

    // 2. base-name matching
    for (let i = pdfLeft.length - 1; i >= 0; i--) {
        const pdf = pdfLeft[i];
        const idx = zipLeft.findIndex(z => baseName(z) === baseName(pdf));
        if (idx !== -1) {
            pairs.push({ pdf, zip: zipLeft[idx], confidence: 90, method: "basename" });
            pdfLeft.splice(i, 1);
            zipLeft.splice(idx, 1);
        }
    }

    // 3. timestamp proximity matching
    for (let i = pdfLeft.length - 1; i >= 0; i--) {
        const pdf = pdfLeft[i];
        let bestIdx = -1;
        let bestDiff = Infinity;
        zipLeft.forEach((z, idx) => {
            const diff = timeDiff(pdf, z);
            if (diff < bestDiff) {
                bestDiff = diff;
                bestIdx = idx;
            }
        });
        if (bestIdx !== -1 && bestDiff <= timeThreshold) {
            pairs.push({ pdf, zip: zipLeft[bestIdx], confidence: 60,
                         method: `timestamp<=${timeThreshold}s` });
            pdfLeft.splice(i, 1);
            zipLeft.splice(bestIdx, 1);
        }
    }

    if (pdfLeft.length || zipLeft.length) {
        warnings.push("Unpaired files remain – manual review required");
    }

    return {
        pairs,
        unpairedPdfs: pdfLeft,
        unpairedZips: zipLeft,
        warnings,
    };
}

module.exports = {
    associateFilesForSubmission,
};
