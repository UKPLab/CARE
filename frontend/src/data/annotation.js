export class Annotation{
    id;
    comment;
    anchor;
    annotationData;
    document_id;

    // todo: add necessary attributes and methods

    constructor(id, comment, anchor, annotationData) {
        this.id = id;
        this.comment = comment;
        this.anchor = anchor;
        this.annotationData = annotationData;
        this.document_id = 1;
    }

    toJson() {
        return JSON.stringify(comment);
    }
}