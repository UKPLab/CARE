import { v4 } from 'uuid';


export class Annotation{
    id;
    comment;
    anchors;
    annotationData;
    document_id;
    orphaned;
    user;
    hover;

    // todo: add necessary attributes and methods

    constructor(document_id, comment, anchor, annotationData, user) {
        this.document_id = document_id
        this.id = v4();
        this.anchors = null;
        this.hover = false;
        this.comment = comment;

        this.annotationData = annotationData;
        this.orphaned = false;

        this.user = user;
    }

    toJson() {
        return JSON.stringify(comment);
    }
}