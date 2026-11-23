<template>
              <div class="template-editor-surface" :class="{'template-editor-surface--preview': previewMode}">
                <div
                  v-show="!previewMode"
                  :id="`editor-container-template-${templateId}`"
                  class="template-editor-container"
                  @paste="$emit('paste', $event)"
                  @copy="$emit('copy', $event)"
                >
                </div>
              </div>
</template>

<script>
/** Owns the stable DOM host and toolbar styling used by the Quill editor instance. */
export default {
  name: "TemplateQuillSurface",
  props: {templateId: {type: Number, required: true}, previewMode: {type: Boolean, default: false}},
  emits: ['paste', 'copy'],
};
</script>

<style scoped>
.template-editor-surface {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

.template-editor-surface:not(.template-editor-surface--preview) {
    flex: 1 1 auto;
  }

.template-editor-surface--preview {
    flex: 0 0 auto;
    position: relative;
    z-index: 2;
    overflow: visible;
  }

.template-editor-surface .ql-toolbar {
    position: relative;
    z-index: 2;
  }

.template-editor-container {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

.template-editor-surface .ql-container {
    flex: 1;
    min-height: 0;
  }
</style>

<style>

.ql-toolbar .ql-languageSelector {
    min-width: 100px;
    background-color: var(--bs-tertiary-bg, #f5f5f5);
    margin-left: 10px;
  }
  .ql-toolbar .ql-languageSelector .ql-picker-label {
    padding: 2px 8px;
  }
  .ql-toolbar .ql-languageSelector .ql-picker-label svg {
    width: 14px;
    height: 14px;
  }

  .ql-toolbar .ql-templateViewMode {
    min-width: 90px;
    background-color: var(--bs-tertiary-bg);
    margin-left: 6px;
  }
  .ql-toolbar .ql-templateViewMode .ql-picker-label {
    padding: 2px 8px;
  }
  .ql-toolbar .ql-templateViewMode .ql-picker-label svg {
    width: 14px;
    height: 14px;
  }

  .ql-toolbar .ql-languageSelector.ql-expanded,
  .ql-toolbar .ql-templateViewMode.ql-expanded {
    z-index: 10;
  }

  .ql-toolbar .ql-languageSelector .ql-picker-options,
  .ql-toolbar .ql-templateViewMode .ql-picker-options {
    z-index: 11;
  }

</style>
