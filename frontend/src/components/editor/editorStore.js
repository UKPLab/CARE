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

// Quill toolbar tools, each shown when its setting is "true"
const TOOLBAR_TOOLS = {
    "editor.toolbar.tools.font": {font: []},
    "editor.toolbar.tools.size": {size: []},
    "editor.toolbar.tools.align": {align: []},
    "editor.toolbar.tools.header": ["header", "1", "2", "3", "4", "5", "6"],
    "editor.toolbar.tools.bold": "bold",
    "editor.toolbar.tools.italic": "italic",
    "editor.toolbar.tools.underline": "underline",
    "editor.toolbar.tools.strike": "strike",
    "editor.toolbar.tools.blockquote": "blockquote",
    "editor.toolbar.tools.code-block": "code-block",
    "editor.toolbar.tools.formula": "formula",
    "editor.toolbar.tools.subscript": {script: "sub"},
    "editor.toolbar.tools.superscript": {script: "super"},
    "editor.toolbar.tools.indent": [{indent: "-1"}, {indent: "+1"}],
    "editor.toolbar.tools.direction": {direction: []},
    "editor.toolbar.tools.color": {color: []},
    "editor.toolbar.tools.background": {background: []},
    "editor.toolbar.tools.orderedList": {list: "ordered"},
    "editor.toolbar.tools.unorderedList": {list: "bullet"},
    "editor.toolbar.tools.checkList": {list: "check"},
    "editor.toolbar.tools.link": "link",
    "editor.toolbar.tools.image": "image",
    "editor.toolbar.tools.video": "video",
    "editor.toolbar.tools.clean": "clean"
};

// Hidden, because their functionality has not been handled yet
const HIDDEN_TOOLBAR_TOOLS = ['editor.toolbar.tools.formula', 'editor.toolbar.tools.link', 'editor.toolbar.tools.image', 'editor.toolbar.tools.video'];

/**
 * The Quill toolbar tools enabled in the settings.
 *
 * @param {function(string): string} getSetting returns the value of a setting key
 * @returns {Array} the toolbar container entries
 */
export function getToolbarTools(getSetting) {
    return Object.entries(TOOLBAR_TOOLS)
        .filter(([key]) => !HIDDEN_TOOLBAR_TOOLS.includes(key) && getSetting(key) === "true")
        .map(([, tool]) => tool);
}
