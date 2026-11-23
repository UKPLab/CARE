<template>
            <div
              class="template-example-preview-panel border rounded bg-body-tertiary"
            >
              <div class="alert alert-info mb-0 rounded-0 py-2 small template-preview-banner">
                {{ $t("templates.editor.viewMode.previewHelp") }}
              </div>
              <div class="ql-snow template-preview-scroll p-3">
                <TemplatePreviewHtml
                  class="ql-editor template-example-preview-inner"
                  :html="html"
                />
              </div>
            </div>
</template>

<script>
import TemplatePreviewHtml from "./TemplatePreviewHtml.vue";
export default {
  name: "TemplateExamplePreview",
  components: {TemplatePreviewHtml},
  props: {html: {type: String, default: ''}},
};
</script>

<style scoped>
  .template-example-preview-panel {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    position: relative;
    z-index: 1;
  }

  .template-preview-banner {
    flex-shrink: 0;
  }

  .template-preview-scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
  }

  .template-example-preview-inner {
    white-space: pre-wrap;
    min-height: 0;
  }
</style>
