const Delta = require('quill-delta');

/**
 * Converts an array of database entries to a Quill Delta object.
 *
 * This method takes an array of database entries as input and returns a Quill Delta object.
 *
 * @param {array} dbEntries - The array of database entries to convert to a Quill Delta object.
 * @returns {object} The Quill Delta object representation of the database entries.
 */
function dbToDelta(dbEntries) {
    return dbEntries.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).reduce((compositeDelta, edit) => {
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
        if ('retain' in op && !('attributes' in op)) {
            offset = op.retain; 
        }
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
        if ('insert' in op) {
            offset += op.insert.length; 
        }
        return pV;
    }, []);
}

module.exports = {
    deltaToDb: deltaToDb,
    dbToDelta: dbToDelta,
}