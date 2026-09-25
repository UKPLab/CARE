/**
 * Manages placeholder-example preview functionality for TemplateEditor.vue.
 *
 * Fetches placeholder examples, switches between editing and preview
 * modes, inserts placeholder text at the cursor, and notifies listeners
 * when editor content changes.
 *
 * Reuses placeholderExamplePreview.js to generate the preview HTML.
 * Exports data, computed properties, and methods for spread
 * composition into TemplateEditor.vue.
 *
 * @author Mohammad Elwan
 */

import Quill from "quill";
import { resolveApiMessage } from "@/assets/utils";
import {buildExamplePreviewHtml, mapPlaceholderPreviewRows} from "@/components/editor/template/placeholderExamplePreview.js";

const Delta = Quill.import('delta');

// Fresh data factory so placeholder-preview state is never shared across component instances
export function templatePlaceholderPreviewData() {
  return {
    previewMode: false,
    placeholderPreviewList: [],
    lastEditorHtml: "",
  };
}

export const templatePlaceholderPreviewComputed = {
  templateSupportsPlaceholderPreview() {
    const t = this.template;
    if (!t || t.type == null) {
      return false;
    }
    return [1, 2, 3, 6, 7, 8].includes(t.type);
  },
  previewDisplayHtml() {
    if (!this.previewMode || !this.templateSupportsPlaceholderPreview) {
      return "";
    }
    return buildExamplePreviewHtml(this.lastEditorHtml, this.placeholderPreviewList, {
      bracketOnly: this.template?.type === 8,
    });
  },
};

export const templatePlaceholderPreviewMethods = {
  fetchPlaceholderExamples() {
    if (!this.templateId || this.templateId <= 0) {
      return;
    }
    this.$socket.emit("templatePlaceholderGetAll", { templateId: this.templateId }, (result) => {
      if (result.success) {
        this.placeholderPreviewList = mapPlaceholderPreviewRows(result.data);
      } else {
        this.eventBus.emit("toast", {
          title: this.$t("templates.placeholders.failedToLoad"),
          message: resolveApiMessage(result),
          variant: "danger",
        });
      }
    });
  },

  /**
   * Toggle between Quill edit and example-value HTML preview.
   *
   * @param {boolean} on
   */
  setPreviewMode(on) {
    this.previewMode = !!on;
    if (this.previewMode && this.editor) {
      this.lastEditorHtml = this.editor.getEditor().root.innerHTML;
    }
    if (this.editor) {
      this.editor.getEditor().enable(!this.readOnly && !this.previewMode);
    }
    this.syncEditPreviewPickerLabel();
    this.syncToolbarFormatVisibility();
    this.$emit("preview-mode-change", this.previewMode);
  },

  insertTextAtCursor(text) {
    if (this.editor) {
      const quill = this.editor.getEditor();
      const range = quill.getSelection();
      if (range) {
        const placeholderDelta = new Delta().retain(range.index).insert(text);
        quill.updateContents(placeholderDelta);
        this.deltaBuffer.push(placeholderDelta);
        this.debouncedProcessDelta();
        quill.setSelection(range.index + text.length);

        this.emitContentForPlaceholders();
      } else {
        this.eventBus.emit("toast", {
          title: this.$t("templates.editor.toasts.noCursorPosition.title"),
          message: this.$t("templates.editor.toasts.noCursorPosition.message"),
          variant: "warning",
        });
      }
    }
  },
  emitContentForPlaceholders() {
    if (this.editor) {
      const content = this.editor.getEditor().root.innerHTML;
      this.lastEditorHtml = content;
      this.eventBus.emit("editorContentUpdated", {
        templateId: this.templateId,
        content: content,
      });
    }
  },
};
