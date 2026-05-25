/**
 * 
 * This module provides methods to convert between Quill Delta objects and database entries.
 * 
 * @author Juliane Bechert
 * 
 */
const Delta = require('quill-delta');

/**
 * Converts an array of database entries to a Quill Delta object.
 *
 * This method takes an array of database entries as input, sorts them by creation date,
 * and returns a Quill Delta object. It supports three types of operations: insert, delete, 
 * and retain with attributes.
 *
 * @param {array} dbEntries - The array of database entries to convert to a Quill Delta object.
 * @returns {object} The Quill Delta object representation of the database entries.
 */
function dbToDelta(dbEntries) {
    return dbEntries.sort((a, b) => {
                const timeCompare = new Date(a.createdAt) - new Date(b.createdAt);
                if (timeCompare !== 0) return timeCompare;
                return (a.order || 0) - (b.order || 0);
            }).reduce((compositeDelta, edit) => {
            const { operationType, offset, span, text, attributes } = edit;
            let delta = new Delta();

            switch (operationType) {
                case 0: // Insert
                    delta = new Delta().retain(offset).insert(text, attributes);
                    break;
                case 1: // Delete
                    delta = new Delta().retain(offset).delete(span);
                    break;
                case 2: // Retain with attributes
                    delta = new Delta().retain(offset).retain(span, attributes);
                    break;
                default:
                    throw new Error(`Unknown operation type: ${operationType}`);
            }

            return compositeDelta.compose(delta);
        }, new Delta());
}

/**
 * Returns the operation type of a Quill Delta operation. Used in method deltaToDb.
 *
 * This method takes a Quill Delta operation as input and returns the corresponding operation type.
 *
 * @param {object} op - The Quill Delta operation to get the operation type for.
 * @returns {number} The operation type of the Quill Delta operation.
 */
function getOperationType(op) {
    if ('insert' in op) {
        return 0; // Insert
    } else if ('delete' in op) {
        return 1; // Delete
    } else if ('retain' in op && 'attributes' in op) {
        return 2; // Attribute Change
    } else {
        return -1;
    }
}

/**
 * Returns the span of a Quill Delta operation. Used in method deltaToDb.
 *
 * This method takes a Quill Delta operation as input and returns the corresponding span.
 *
 * @param {object} op - The Quill Delta operation to get the span for.
 * @returns {number} The span of the Quill Delta operation.
 */
function getSpan(op) {
    if ('insert' in op) {
        return op.insert.length;
    } else if ('delete' in op) {
        return op.delete;
    } else {
        return op.retain;
    }
}

/**
 * Converts a Quill Delta object to an array of database entries.
 *
 * This method takes a Quill Delta object as input and returns an array of database entries.
 *
 * @param {array} ops - The Quill Delta object to convert to database entries.
 * @returns {array} The array of database entries.
 */
function deltaToDb(ops) {
    let offset = 0;
    return ops.reduce(function (pV, op) {
        const operationType = getOperationType(op);
        if (operationType >= 0) {
            pV.push({
                offset,
                operationType: operationType,
                span: getSpan(op),
                text: 'insert' in op ? op.insert : null,
                attributes: 'attributes' in op ? op.attributes : null
            });
        }
        if ('retain' in op) {
            offset += op.retain;
        } else if ('insert' in op) {
            offset += op.insert.length;
        } else if ('delete' in op) {
            // No change to offset needed for delete operations
        }
        return pV;
    }, []);
}

/**
 * Extract plain text from a Quill Delta or ops array.
 *
 * It concatenates all string `insert` values from the operations in order.
 *
 * @param {object|array} deltaOrOps - Quill Delta ({ ops: [...] }) or ops array
 * @returns {string} Concatenated string inserts
 */
function deltaToPlainText(deltaOrOps) {
    if (!deltaOrOps) return "";
    const ops = Array.isArray(deltaOrOps)
        ? deltaOrOps
        : (deltaOrOps.ops || []);

    return ops
        .filter(op => op.insert && typeof op.insert === "string")
        .map(op => op.insert)
        .join("");
}

/**
 * Converts a Quill Delta object to an HTML string.
 * Each newline in the delta marks the end of a paragraph and is flushed as a <p> tag.
 * Supports bold, italic, underline, and link attributes.
 *
 * @param {object|array} deltaOrOps - Quill Delta ({ ops: [...] }) or ops array
 * @returns {string} A full HTML document string
 */
function deltaToHtml(deltaOrOps) {
    if (!deltaOrOps) return "";
    const ops = Array.isArray(deltaOrOps)
        ? deltaOrOps
        : (deltaOrOps.ops || []);

    let html = '';
    let lineBuffer = [];

    const flushLine = () => {
        html += '<p>' + (lineBuffer.join('') || '<br>') + '</p>\n';
        lineBuffer = [];
    };

    for (const op of ops) {
        if (typeof op.insert !== 'string') continue;

        const lines = op.insert.split('\n');
        lines.forEach((segment, i) => {
            if (segment.length > 0) {
                let content = segment
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');

                if (op.attributes) {
                    if (op.attributes.bold)      content = `<strong>${content}</strong>`;
                    if (op.attributes.italic)    content = `<em>${content}</em>`;
                    if (op.attributes.underline) content = `<u>${content}</u>`;
                    if (op.attributes.link)      content = `<a href="${op.attributes.link}">${content}</a>`;
                }
                lineBuffer.push(content);
            }
            if (i < lines.length - 1) flushLine();
        });
    }
    if (lineBuffer.length > 0) flushLine();

    return `<!DOCTYPE html>\n<html>\n<body>\n${html}</body>\n</html>`;
}

module.exports = {
    deltaToDb: deltaToDb,
    dbToDelta: dbToDelta,
    deltaToPlainText: deltaToPlainText,
    deltaToHtml: deltaToHtml,
}