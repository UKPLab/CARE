import {omitObjectAttributeSubset} from "./utils";
import {Validator} from "jsonschema";

/**
 * Returns an object with nested objects representing the thread of comments drawn from the provided list of
 * comments starting with the provided root comment.
 *
 * @param root the root comment
 * @param comms the list of comments, where the children are drawn from
 * @returns {Object}
 */
function getCommentThread(root, comms) {
    const children = comms.filter(c => c.parentCommentId === root.id);

    if (children.length === 0) {
        return omitObjectAttributeSubset(root, ["annotationId", "commentId"]);
    }

    return Object.fromEntries(Object.entries(root).concat([["replies", children.map(c => getCommentThread(c, comms))]]));
}

/**
 * Merges a list of annotations and comments, such that the result is a pair of arrays, where the first
 * contains a list of annotations with associated comments and the second is a list of document comments.
 *
 * @param annos annotations to consider
 * @param comms comments to consider
 * @returns {[Array, Array]}
 */
export function mergeAnnotationsAndComments(annos, comms) {
    const mapped = annos.map(anno => {
        let res = Object.fromEntries(Object.entries(anno));

        const root_comm = comms.find(comm => comm.annotationId === anno.id);
        if (root_comm !== undefined) {
            const comm_thread = getCommentThread(root_comm, comms);

            return Object.assign(res, {comment: comm_thread})
        }

        return res;
    });

    const unmapped = comms.filter(comm => comm.annotationId === null && comm.parentCommentId === null)
        .map(comm => omitObjectAttributeSubset(comm, ["annotationId", "commentId"]));

    return [mapped, unmapped]
}

export function validateServiceConfig(config) {
    // todo future: use jsonschema-style checking based on a shared schema definition file

    // should exist and be an object
    if (!config || typeof (config) !== "object") {
        return false;
    }

    // base fields always expected
    for (const f of ["name", "description", "input", "output"]) {
        if (!config[f]) {
            return false;
        }
    }

    // input + output formatting
    for (const f of ["input", "output"]) {
        // data is mandatory
        if (!config[f]["data"] || typeof(config[f]["data"]) !== "object") {
            return false;
        }
    }

    return true;
}