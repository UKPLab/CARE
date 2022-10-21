/* Data object for Annotations

Defines the data object for annotations

// TODO: change structure to db

Author: Nils Dycke (dycke@ukp...)
Source: -
*/
import {v4} from 'uuid';
import Papa from 'papaparse';

export class Annotation {
    id; //annotation ids
    comment; // comment (or comments) on top of the annotation -> move the comment outside.
    anchors;
    annotationData; // annotation data itself (so offset etc. information)
    document_id;
    orphaned;
    user;
    hover;
    text;
    tags;

    state;

    // todo: add necessary attributes and methods

    constructor(id, document_id, text, anchor, annotationData, user, tags) {
        this.document_id = document_id;
        this.id = id;
        this.anchors = null;
        this.hover = false;
        this.comment = null;
        this.text = text;
        this.tags = tags !== null ? tags : [];

        this.state = "CREATED";

        this.annotationData = annotationData;
        this.orphaned = false;

        this.user = user;
    }

    hasComment() {
        return this.comment != null;
    }

    toJson() {
        return JSON.stringify(this.comment);
    }
}

export function createAnnotation(document_id, text, anchor, annotationData, user, tags) {
    return new Annotation(
        v4(),
        document_id,
        text,
        anchor,
        annotationData,
        user,
        tags);
}

function subSelectFields(annoObj, annoFields = null, commentFields = null) {
    let data;
    if (annoFields !== null) {
        data = Object.fromEntries(
            Object.entries(annoObj).filter((a) => {
                return annoFields.indexOf(a[0]) !== -1;
            })
        );
    } else {
        data = Object.assign({}, annoObj);
    }

    // anchors are excluded by default
    if (data.anchors !== undefined) {
        delete data.anchors;
    }

    // dealing with the annotationData object
    if (data.annotationData !== undefined) {
        if (data.annotationData.target !== undefined && data.annotationData.target[0].selector !== undefined) {
            data.annotationData = data.annotationData.target[0].selector[1].exact;
        } else {
            data.annotationData = "UNK";
        }
    }

    // dealing with comment object
    if (data.comment !== undefined) {
        let cdata;
        if (commentFields !== null && data.comment !== null) {
            cdata = Object.fromEntries(Object.entries(data.comment).filter((a) => {
                return commentFields.indexOf(a[0]) !== -1;
            }));
        } else {
            cdata = Object.assign({}, annoObj);
        }

        // remove comment field from data and unroll its contents instead
        delete data.comment

        cdata = Object.fromEntries(Object.entries(cdata).map(e => ["comment_" + e[0], e[1]]));
        data = Object.assign(data, cdata);
    }

    return data;
}

/**
 * Fills the passed annotations and comments into an CSV object. Note that the generated CSV object
 * by default drops all columns with all null values, so the header does not have to be the same for
 * all output files.
 *
 * You may pass a list of attribute names both for the comments and the annotation, which are then
 * subselected for the CSV.
 *
 * @param annotations list of annotation objects
 * @param comments object mapping annotation ids to comment objects
 * @param annoFields opt., whitelist of fields to include from annotations
 * @param commentFields opt., whitelist of fields to include from comments
 * @returns {ObjectsToCsv} call await toString(allColumns=True) to produce a CSV string from this object
 */
export function toCSV(annotations, annoFields = null, commentFields = null) {
    const data = annotations.map((anno) => {
        return subSelectFields(anno, annoFields, commentFields);
    });

    return Papa.unparse(data);
}