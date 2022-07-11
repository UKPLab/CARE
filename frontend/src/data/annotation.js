import { v4 } from 'uuid';


export class Annotation{
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

    constructor(id, document_id, text, anchor, annotationData, user) {
        this.document_id = document_id;
        this.id = id;
        this.anchors = null;
        this.hover = false;
        this.comment = null;
        this.text = text;
        this.tags = [];

        this.state = "CREATED";

        this.annotationData = annotationData;
        this.orphaned = false;

        this.user = user;
    }

    hasComment() {
        return this.comment != null;
    }

    toJson() {
        return JSON.stringify(comment);
    }
}

export function createAnnotation(document_id, text, anchor, annotationData, user) {
    return new Annotation(
        v4(),
        document_id,
        text,
        anchor,
        annotationData,
        user);
}