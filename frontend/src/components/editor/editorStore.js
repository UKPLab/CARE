import Quill from "quill";
import {toRaw} from 'vue';

// make sure, it's not been reactive!
const state = {editor: undefined};

/**import {LeafBlot, Scope} from 'parchment';

 * Editor Store
 *
 * @author Dennis Zyska
 */
export class Editor {

    constructor(container, options) {
        this.container = toRaw(container);
        this.options = options;
        this.init();
    }

    init() {
        state.editor = new Quill(this.container, this.options);
    }

    getEditor() {
        return state.editor;
    }

}