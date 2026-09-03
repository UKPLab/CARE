"use strict";

/**
 * Re-export so legacy `services/ai.js` consumers resolve the modular `AIService` facade.
 *
 * @module webserver/services/ai
 * @author Akash Gundapuneni
 */

module.exports = require("./ai/AIService.js");
