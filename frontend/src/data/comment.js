/* Data object for Comments

Defines the data object for commentaries

Author: Nils Dycke (dycke@ukp...)
Source: -
*/
import {v4} from 'uuid';


export class Comment {
    id;
    text;
    referenceAnnotation;
    referenceComment;
    tags;
    user;

    constructor(id, text, referenceAnnotation, referenceComment, user) {
        if (id == null) {
            this.id = v4();
        } else {
            this.id = id;
        }
        this.tags = [];
        this.user = user;
        this.text = text;

        this.referenceAnnotation = referenceAnnotation;
        this.referenceComment = referenceComment;
    }

    toJson() {
        return JSON.stringify(text);
    }
}