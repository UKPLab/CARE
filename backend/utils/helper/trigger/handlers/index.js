"use strict";

const sendEmail = require("./email.js");
const runAiPreprocessing = require("./aiPreprocessing.js");

module.exports = Object.freeze({
    send_email: sendEmail,
    nlp_preprocess: runAiPreprocessing,
});
