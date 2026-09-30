"use strict";

const TranslatableError = require("../TranslatableError");

/**
 * Refuse inverted or zero-length start/end windows. Either date may be null.
 *
 * @param {object} record - Row or instance with start/end.
 * @param {string} errorKey - i18n key thrown when start is not before end.
 * @returns {void}
 * @throws {TranslatableError} If both dates are set and start is not before end.
 */
function assertStartBeforeEnd(record, errorKey) {
	const start = record.start;
	const end = record.end;
	if (!start || !end) {
		return;
	}
	const startMs = new Date(start).getTime();
	const endMs = new Date(end).getTime();
	if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
		return;
	}
	if (startMs >= endMs) {
		throw new TranslatableError(errorKey);
	}
}

module.exports = { assertStartBeforeEnd };
