import Papa from 'papaparse';
import yaml from 'js-yaml';
import {omitObjectAttributeSubset} from "./utils";


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

// Attributes of annotations and comments that the annotation download leaves out
const EXPORT_OMITTED_ATTRIBUTES = [
    "draft", "anonymous", "createdAt", "updatedAt", "deleted", "deletedAt", "documentId", "studySessionId",
    "studyStepId", "userId",
];

/**
 * Prepares annotations and comments for the annotation download: drops internal and personal attributes, names
 * the tag of each annotation instead of its id, and threads the comments (see mergeAnnotationsAndComments).
 *
 * @param annos annotations to export
 * @param comms comments to export
 * @param {function(number): string} getTagName returns the name of a tag id
 * @returns {[Array, Array]}
 */
export function exportAnnotationsAndComments(annos, comms, getTagName) {
    const strip = (entry) => omitObjectAttributeSubset(entry, EXPORT_OMITTED_ATTRIBUTES);
    const annotations = annos.map(strip).map((anno) => {
        if (!anno.tagId) return anno;
        const {tagId, ...rest} = anno;
        return {...rest, tag: getTagName(tagId)};
    });
    return mergeAnnotationsAndComments(annotations, comms.map(strip));
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
/**
 * Returns a CSV version of the provided object. Requires Papa parse formatting.
 *
 * @param objs
 * @returns {*}
 */
export function objectsToCSV(objs) {
    return Papa.unparse(objs);
}

/**
 * Returns a JSON string of the provided objects (including pretty printing).
 *
 * @param objs
 * @returns {string}
 */
export function objectsToJSON(objs) {
    return JSON.stringify(objs, null, 2);
}

/**
 * Returns a YAML string of the provided objects.
 *
 * @param objs
 * @returns {string}
 */
export function objectsToYAML(objs) {
    return yaml.dump(objs, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        sortKeys: true
    });
}

/**
 * Exports a list of objects into a single string, where nested objects are visualized by indentation.
 *
 * @param objs
 * @returns {String}
 */
export function objectsToTXT(objs) {
    return objs.map(o => Object.entries(o).map(([k, v]) => {
            if (typeof v === "object" && v !== null) {
                return `${k}\n${objectsToTXT([v])}`;
            } else if (v === null) {
                return `${k}:-`;
            } else {
                return `${k}:  ${v}`;
            }
        }).join("\n")
    ).join("\n\n");
}

/**
 * Maps each supported export format to its serializer and MIME type.
 * This is the single source of truth for downloadObjectsAs and getSupportedExportFormats.
 */
const EXPORT_FORMATS = {
    csv: {
        serialize:   objectsToCSV,
        mimeType:    "text/csv",
        label:       "modals.importExport.formats.csv.label",
        icon:        "filetype-csv",
        description: "modals.importExport.formats.csv.description",
        extensions:  [".csv"],
    },
    json: {
        serialize:   objectsToJSON,
        mimeType:    "application/json",
        label:       "modals.importExport.formats.json.label",
        icon:        "filetype-json",
        description: "modals.importExport.formats.json.description",
        extensions:  [".json"],
        parse:       (content) => JSON.parse(content),
    },
    txt: {
        serialize:   objectsToTXT,
        mimeType:    "text/plain",
        label:       "modals.importExport.formats.txt.label",
        icon:        "filetype-txt",
        description: "modals.importExport.formats.txt.description",
        extensions:  [".txt"],
    },
    yaml: {
        serialize:   objectsToYAML,
        mimeType:    "application/x-yaml",
        label:       "modals.importExport.formats.yaml.label",
        icon:        "filetype-yml",
        description: "modals.importExport.formats.yaml.description",
        extensions:  [".yaml", ".yml"],
        parse:       (content) => yaml.load(content),
    },
};

/**
 * Returns all supported export formats for downloadObjectsAs.
 *
 * @returns {string[]}
 */
export function getSupportedExportFormats() {
    return Object.entries(EXPORT_FORMATS).map(([key, { label, icon, description }]) => ({ key, label, icon, description }));
}

/**
 * Returns all formats that can be parsed back for import (i.e. those with a parse function).
 *
 * @returns {{ key: string, label: string, icon: string, description: string, extensions: string[], parse: function }[]}
 */
export function getSupportedImportFormats() {
    return Object.entries(EXPORT_FORMATS)
        .filter(([, fmt]) => typeof fmt.parse === "function")
        .map(([key, { label, icon, description, extensions, parse }]) => ({ key, label, icon, description, extensions, parse }));
}

/**
 * Downloads the provided objects by the given file type under the given file name.
 *
 * @param objs objects to be downloaded in the browser
 * @param name name of the resulting file
 * @param file_type the type of the file, either {"csv" | "json" | "txt" | "yaml"}
 */
export function downloadObjectsAs(objs, name, file_type) {
    const format = EXPORT_FORMATS[file_type];
    if (!format) {
        throw `Invalid argument '${file_type}' passed to downloadObjectsAs`;
    }
    const data = format.serialize(objs);
    window.saveAs(new Blob([data], {type: `${format.mimeType};charset=utf-8`}), `${name}.${file_type}`);
}
