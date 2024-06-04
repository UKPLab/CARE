const Delta = require('quill-delta');
const {QuillDeltaToHtmlConverter} = require('quill-delta-to-html');

/**
 * Converts a Quill Delta object to HTML.
 *
 * This method takes a Quill Delta object as input and returns the corresponding HTML.
 *
 * @param {object} delta - The Quill Delta object to convert to HTML.
 * @returns {string} The HTML representation of the Quill Delta object.
 */
function deltaToHtml(delta) {
    const converter = new QuillDeltaToHtmlConverter(delta.ops, {}); 
    return converter.convert();
} 

/**
 * Converts an array of database entries to a Quill Delta object.
 *
 * This method takes an array of database entries as input and returns a Quill Delta object.
 *
 * @param {array} dbEntries - The array of database entries to convert to a Quill Delta object.
 * @returns {object} The Quill Delta object representation of the database entries.
 */
function dbToDelta(dbEntries) {
    return dbEntries.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).map(edit => {
        const {operationType, offset, span, text, attributes} = edit;

        let delta = new Delta();

        switch (operationType) {
            case 0: // Insert
                delta = delta.retain(offset).insert(text, attributes);
                break;
            case 1: // Delete
                delta = delta.retain(offset).delete(span);
                break;
            case 2: // Retain with attributes
                delta = delta.retain(offset).retain(span, attributes);
                break;
            default:
                throw new Error(`Unknown operation type: ${operationType}`);
        }

        return delta;

    });

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
    } else if ('attribute' in op) {
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
 * Concatenates an array of Quill Delta objects into a single Quill Delta object. Used for method setContent in Editor.vue to present data in the corrct format.
 *
 * This method takes an array of Quill Delta objects as input and returns a single Quill Delta object.
 *
 * @param {array} deltas - The array of Quill Delta objects to concatenate.
 * @returns {object} The concatenated Quill Delta object.
 */
function concatDeltas(deltas) {
    let result = new Delta();
  
    deltas.forEach(delta => {
        delta.ops.forEach(op => {
          if (op.insert) {
            result.insert(op.insert, op.attributes || {});
          }
          /*
          if (op.retain !== undefined) {
            result.retain(op.retain);
          }
          */
          if (op.delete !== undefined) {
            result.delete(op.delete);
          }
        });
      });

    return result;
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
        if (op.retain) {
            offset += op.retain;
        }
        if (getOperationType(op) >= 0) {
            pV.push({
                offset,
                operationType: getOperationType(op),
                span: getSpan(op),
                text: op.insert || null,
                attributes: op.attributes || null
            });
        }
        return pV;

    }, []);
}

module.exports = {
    deltaToDb: deltaToDb,
    dbToDelta: dbToDelta,
    deltaToHtml: deltaToHtml,
    concatDeltas: concatDeltas
}