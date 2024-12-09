const {Op} = require("sequelize");

/**
 * Merge all filters into a single filter list
 * @param allFilter
 * @param possibleAttributes
 * @returns {*|*[]}
 */
function mergeFilter(allFilter, possibleAttributes = []) {
    // check if there is an empty array in allFilter, as we then need to retrieve all data anyway
    if (allFilter.every(filter => filter.length === 0)) {
        return [];
    }

    // Step 1: Collect all unique keys across all filters
    const mergedFilter = allFilter.map(filters => {
        const filter = {};
        for (let filterItem of filters) {
            if (filterItem.key in possibleAttributes) {
                if (filterItem.values && filterItem.values.length > 0) {
                    filter[filterItem.key] = {[Op.or]: filterItem.values};
                } else {
                    if (filterItem.type === "not") {
                        filter[filterItem.key] = {[Op.not]: filterItem.value};
                    } else {
                        filter[filterItem.key] = filterItem.value;
                    }
                }
            }
        }
        return filter;
    });

    return mergedFilter;
}

function mergeInjects(allInjects) {
    if (allInjects.every(injection => injection.length === 0)) {
        return [];
    }

    return [].concat.apply([], allInjects);

}

module.exports = {
    mergeFilter,
    mergeInjects,
}