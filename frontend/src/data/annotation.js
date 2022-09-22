/* Data object for Annotations

Defines the data object for annotations

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

function subSelectFields(dataObj, fields=null){
    let data;
    if(fields !== null){
        data = Object.fromEntries(Object.entries(dataObj).filter((a) => {
            return fields.indexOf(a[0]) !== -1;
        }));
    } else {
        data = Object.assign({}, dataObj);
    }

    data = Object.fromEntries(Object.entries(data).map(e => [e[0], e[1]]));

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
 * @param anno_fields opt., whitelist of fields to include from annotations
 * @param comment_fields opt., whitelist of fields to include from comments
 * @returns {ObjectsToCsv} call await toString(allColumns=True) to produce a CSV string from this object
 */
export function toCSV(annotations, anno_fields=null, comment_fields=null) {
    const data = annotations.map((anno) => {
       let filtered_anno = subSelectFields(anno, anno_fields);
       const comm = anno.comment;

       if(comm !== undefined){
           let filtered_comm = subSelectFields(comm, comment_fields);
           filtered_comm = Object.fromEntries(Object.entries(filtered_comm).map(e => ["comment_"+e[0], e[1]]));
           filtered_anno = Object.assign(filtered_anno, filtered_comm);
       }

       return filtered_anno;
    });

    console.log(data);

    return Papa.unparse(data);
}