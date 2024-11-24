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
        if (!x[key]) { // If the key is not present, return the object as is
          return x;
        } else {
          return {
            ...x,
            [targetName]: await func(x[key]),
          };
        }
      })
    );
}