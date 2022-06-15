export class Annotation{
    id;
    comment;
    anchor;
    annotationData;

    // todo: add necessary attributes and methods

    constructor(id, comment, anchor, annotationData) {
        this.id = id;
        this.comment = comment;
        this.anchor = anchor;
        this.annotationData = annotationData;
    }

    toJson() {
        return JSON.stringify(comment);
    }
}