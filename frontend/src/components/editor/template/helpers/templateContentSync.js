/**
 * Manages content synchronization and persistence for TemplateEditor.vue.
 *
 * Buffers Quill content changes, handles debounced saving, and flushes
 * pending edits before closing or discarding a template.
 * Also warns users about unsaved changes when leaving the page.
 *
 * Exports data, computed properties, and methods for spread
 * composition into TemplateEditor.vue.
 *
 * @author Mohammad Elwan
 */

import Quill from "quill";
import {deltaToDb} from "editor-delta-conversion";
import { resolveApiMessage } from "@/assets/utils";

const Delta = Quill.import('delta');

// Fresh data factory so content-sync state is never shared across component instances
export function templateContentSyncData() {
  return {
    deltaBuffer: [],
    firstVersion: null,
    beforeUnloadHandler: null,
  };
}

export const templateContentSyncComputed = {
  debounceTimeForEdits() {
    return parseInt(this.$store.getters["settings/getValue"]("editor.edits.debounceTime"), 10);
  },
};

export const templateContentSyncMethods = {
  /**
   * Whether the editor content differs from what was last loaded for this language.
   * @returns {boolean}
   */
  hasUnsavedChanges() {
    if (this.firstVersion === null || !this.editor) {
      return false;
    }
    return this.editor.getEditor().root.innerHTML !== this.firstVersion;
  },
  /**
   * Warn on full-page unload (forced URL navigation / tab close) when there are unsaved edits.
   * @param {BeforeUnloadEvent} event
   */
  handleBeforeUnload(event) {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
    }
  },
  /**
   * Request close/save of the current language.
   * Used by the route guard so navigation can be blocked when save fails (e.g. missing required placeholders).
   *
   * @returns {Promise<Object>}
   */
  requestClose() {
    return new Promise((resolve) => {
      this.$socket.emit(
        "templateClose",
        { templateId: this.templateId, language: this.selectedLanguage },
        (res) => resolve(res || { success: false })
      );
    });
  },
  /**
   * Discard draft edits without merging into template_content.
   * Used when leaving after invalid content.
   *
   * @returns {Promise<Object>}
   */
  requestDiscard() {
    return new Promise((resolve) => {
      this.$socket.emit(
        "templateDiscardDrafts",
        { templateId: this.templateId, language: this.selectedLanguage },
        (res) => resolve(res || { success: false })
      );
    });
  },
  /**
   * Persist any pending debounced edits before close/discard checks.
   *
   * The debounce timer may not have fired yet when the user leaves (topbar back,
   * route navigation). This cancels the timer and sends buffered ops via
   * templateEditContent, waiting for the socket callback before templateClose runs.
   *
   * @returns {Promise<void>}
   */
  flushPendingEdits() {
    if (this.debouncedProcessDelta) {
      this.debouncedProcessDelta.cancel();
    }
    if (!this.editor || this.deltaBuffer.length === 0) {
      return Promise.resolve();
    }
    const quill = this.editor.getEditor();
    const combinedDelta = this.deltaBuffer.reduce((acc, delta) => acc.compose(delta), new Delta());
    const dbOps = deltaToDb(combinedDelta.ops);
    if (dbOps.length === 0) {
      this.deltaBuffer = [];
      return Promise.resolve();
    }
    const backup = quill.getContents();
    return new Promise((resolve) => {
      this.$socket.emit(
        "templateEditContent",
        {
          templateId: this.templateId,
          language: this.selectedLanguage,
          ops: dbOps,
        },
        (res) => {
          if (!res.success) {
            quill.setContents(backup);
            this.eventBus.emit("toast", {
              title: this.$t("templates.editor.toasts.previousEditFailed"),
              message: resolveApiMessage(res),
              variant: "danger",
            });
          }
          const currentVersion = this.editor.getEditor().root.innerHTML;
          this.$emit("update:data", {
            firstVersion: this.firstVersion,
            currentVersion: currentVersion,
          });
          this.deltaBuffer = [];
          resolve();
        }
      );
    });
  },
  handleTextChange(delta, oldContents, source) {
    if (source === "user") {
      this.deltaBuffer.push(delta);
      this.debouncedProcessDelta();
      this.emitContentForPlaceholders();
    }
  },
  processDelta() {
    const quill = this.editor.getEditor();
    if (this.deltaBuffer.length > 0) {
      let combinedDelta = this.deltaBuffer.reduce((acc, delta) => acc.compose(delta), new Delta());
      let dbOps = deltaToDb(combinedDelta.ops);
      if (dbOps.length > 0) {
        const backup = quill.getContents();

        this.$socket.emit("templateEditContent", {
          templateId: this.templateId,
          language: this.selectedLanguage,
          ops: dbOps
        }, (res) => {
          if (!res.success) {
            quill.setContents(backup);
            this.eventBus.emit("toast", {
              title: this.$t("templates.editor.toasts.previousEditFailed"),
              message: resolveApiMessage(res),
              variant: "danger",
            });
          }
        });
      }

      let currentVersion = this.editor.getEditor().root.innerHTML;
      let studyData = {
        firstVersion: this.firstVersion,
        currentVersion: currentVersion,
      };
      this.$emit("update:data", studyData);
      this.deltaBuffer = [];
    }
  },
};
