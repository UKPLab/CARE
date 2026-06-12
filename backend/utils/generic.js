// src: https://stackoverflow.com/questions/17781472/how-to-get-a-subset-of-a-javascript-objects-properties
exports.pickObjectAttributeSubset =  function pickObjectAttributeSubset(obj, keys) {
    return Object.fromEntries(keys.filter(key => key in obj).map(key => [key, obj[key]]));
}


/**
 * Returns a copy of the first argument object, where the attributes are replaced by the contents of the second
 * argument object, iff the attribute is present in the latter.
 *
 * @param obj_orig object to be copied
 * @param obj_over object to override attributes of the first object
 * @returns {Object}
 */
exports.overrideObjectAttributes = function overrideObjectAttributes(obj_orig, obj_over) {
    return Object.fromEntries(Object.entries(obj_orig).map(([key, value]) => [key, key in obj_over ? obj_over[key] : value]));
}

/**
 * Injects a new attribute into an object, based on the value of an existing attribute.
 * @param data - object or array of objects
 * @param func - async function to be applied to the value of the key
 * @param targetName - name of the new attribute
 * @param key - key to be used as input for the function - if not present, the object is returned as is
 * @returns {Promise<Awaited<T|*>[]>}
 */
exports.inject = async function inject(data, func, targetName, key = null) {
    if (!Array.isArray(data)) {
      data = [data];
    }

    return Promise.all(
      data.map(async (x) => {
        if (!x || !x[key]) { // If the key is not present, return the object as is
          return x;
        }
        else if (Object.keys(x).includes("anonymous") && x.anonymous) {
          return {
            ...x,
            [targetName]: "Anonymous",
          };
        } else {
          return {
            ...x,
            [targetName]: await func(x[key]),
          };
        }
      })
    );
}

const { hasKey } = require('./i18n');

/**
 * Create an Error with a machine-readable code and an i18n key (no interpolation params).
 *
 * Use when the frontend needs both `code` (branching) and `key` (translation), e.g.
 * `generateError('DOCUMENT_NOT_FOUND', 'errors.documents.doesNotExistOrDeleted')`.
 *
 * For key + params, or key + params + code, use TranslatableError instead.
 *
 * @param {string} code Machine-readable error code for frontend handling
 * @param {string} message i18n key (must exist in en locale JSON)
 * @returns {Error}
 */
exports.generateError = function generateError(code, message) {
    const error = new Error(message);
    error.code = code;
    if (hasKey(message)) {
        error.key = message;
    }
    return error;
}

  /**
     * Reduces a full User-Agent string to a readable browser label.
     * @param {string|undefined} ua
     * @returns {string}
  */
exports.parseUserAgent = function parseUserAgent(ua) {
    if (!ua) return "Unknown";
    if (ua.includes("Edg")) return "Edge";
    if (ua.includes("Chrome")) return "Chrome";
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
    return ua.substring(0, 60);
}