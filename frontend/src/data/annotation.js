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

    // todo: add necessary attributes and methods

    constructor(document_id, comment, anchor, annotationData, user) {
        this.document_id = document_id
        this.id = v4();
        this.anchors = null;
        this.hover = false;
        this.comment = comment;
        this.text = null;
        this.tags = [];

        this.annotationData = annotationData;
        this.orphaned = false;

        this.user = user;
    }

    toJson() {
        return JSON.stringify(comment);
    }
}