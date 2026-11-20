<template>
  <Teleport to="#topbarCenterPlaceholder">
    <div
      v-show="templateId && readOnlyOverwrite"
      :title="$t('common.readOnly')"
    >
      <span :style="{ color: 'var(--bs-danger-text-emphasis)', fontWeight: 'bold' }">
        {{ $t('common.readOnly') }}
      </span>
      <LoadIcon
        :size="22"
        :color="'var(--bs-danger-text-emphasis)'"
        icon-name="lock-fill"
      />
    </div>
  </Teleport>
  <div class="container-fluid d-flex min-vh-100 vh-100 flex-column">
    <div class="row flex-grow-1 overflow-hidden">
      <div id="editorContainer" class="editor-container flex-grow-1">
        <Editor v-if="!templateId" ref="editor" @update:data="$emit('update:data', $event)"/>
        <TemplateEditor
          v-else
          ref="templateEditor"
          @update:data="$emit('update:data', $event)"
          @preview-mode-change="onTemplatePreviewModeChange"
        />
      </div>
      <EditorSidebar
          v-if="!sidebarDisabled"
          ref="sidebar"
          :document="document"
          :template-id="templateId"
          :read-only="readOnly"
          :without-history="withoutHistory"
          :is-shown="sidebarToggleShown"
          :show-template-configurator="showTemplateConfigurator"
          v-bind="{lookBackTabs, shownLookBackStepId, ownTabsHidden, activeSidebar}"
          @sidebar-change="handleSidebarChange"
          @sidebar-visibility-change="handleSidebarVisibilityChange"
          @sidebar-action="handleSidebarAction"
      >
        <template v-for="(slot, slotName) in $slots" :key="slotName" #[slotName]>
          <slot v-if="slotName !== 'default'" :name="slotName"/>
        </template>
      </EditorSidebar>
    </div>
  </div>
</template>


<script>
/**
 * Main Editor component with sidebar
 *
 * This component provides the Quill editor component and a sidebar for different functionalities (e.g. version history).
 *
 * @author Dennis Zyska, Juliane Bechert, Linyin Huang
 */
import EditorSidebar from "./sidebar/EditorSidebar.vue";
import Editor from "@/components/editor/editor/Editor.vue";
import LoadIcon from "@/basic/Icon.vue";
import {computed} from "vue";
import TemplateEditor from "@/components/editor/template/TemplateEditor.vue";
import { emailTemplateTypes } from "@/assets/templateTypes";
import {lookBackPaneProps} from "@/components/study/helpers/lookBack.js";

export default {
  name: "EditorView",
  subscribeTable: ["template"],
  components: {
    EditorSidebar,
    LoadIcon,
    Editor,
    TemplateEditor,
  },
  provide() {
    return {
      documentId: computed(() => this.documentId),
      studyStepId: computed(() => this.studyStepId),
      isStepShown: computed(() => this.isShown),
      readOnly: computed(() => this.readOnlyOverwrite),
      templateId: computed(() => this.templateId),
    }
  },
  inject: {
    readOnly: {
      type: Boolean,
      required: false,
      default: false,
    },
    currentStudyStep: {
      type: Object,
      required: false,
      default: null
    },
    studySessionId: {
      type: Number,
      required: false,
      default: null,
    },
  },
  props: {
    documentId: {
      type: Number,
      required: false,
      default: 0,
    },
    templateId: {
      type: Number,
      required: false,
      default: 0,
    },
    sidebarDisabled: {
      type: Boolean,
      required: false,
      default: false,
    },
    isShown: {
      type: Boolean,
      required: false,
      default: true,
    },
    studyStepId: {
      type: Number,
      required: false,
      default: null,
    },
    ...lookBackPaneProps,
    withoutHistory: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  emits: ["update:data"],
  data() {
    return {
      isSidebarVisible: false,
      sidebarContent: null,
      templatePreviewMode: false,
      sidebarOpenBeforePreview: false,
    };
  },
  computed: {


    showTemplateConfigurator() {
      return (
        this.templateId &&
        this.template &&
        !this.readOnlyOverwrite &&
        this.hasPlaceholders &&
        !this.templatePreviewMode
      );
    },
    sidebarToggleShown() {
      if (this.templateId && this.templatePreviewMode) {
        return false;
      }
      return this.isShown;
    },


    template() {
      if (this.templateId && this.templateId > 0) {
        return this.$store.getters["table/template/get"](Number(this.templateId));
      }
      return null;
    },
    hasPlaceholders() {
      // Email templates (types 1, 2, 3, 6, 7) and prompt templates (type 8) have placeholders
      // Document templates (types 4, 5) have no placeholders
      if (!this.template) return false;
      return emailTemplateTypes.includes(this.template.type) || this.template.type === 8;
    },
    readOnlyOverwrite() {
      if (this.forceReadOnly) {
        return true;
      }
      if (this.sidebarContent === 'history' ) {
        return this.isSidebarVisible;
      }
      if (this.templateId) {
        // If template is not loaded yet, default to read-only (safer)
        if (!this.template) {
          return true;
        }
        // Copies (sourceId set) are always read-only
        if (this.template.sourceId) {
          return true;
        }
        const currentUserId = this.$store.getters["auth/getUser"]?.id;
        const isOwner = this.template.userId === currentUserId;
        const isPublicFromOthers = this.template.public === true && !isOwner;
        if (isPublicFromOthers) {
          return true; 
        }
      }
      return this.readOnly;
    },

    document() {
      if (this.documentId && this.documentId > 0) {
        return this.$store.getters["table/document/get"](this.documentId);
      }
      return null;
    },
  },
  methods: {
    // Methods, not props, so the sidebar gets the same function every time and does not re-render for nothing


    addText(text) {
      if (this.templateId) {
        this.$refs.templateEditor?.addText(text);
      } else {
        this.$refs.editor?.addText(text);
      }
    },
    isEditorEmpty() {
      if (this.templateId) {
        return this.$refs.templateEditor?.isEditorEmpty() || false;
      } else {
        return this.$refs.editor?.isEditorEmpty() || false;
      }
    },
    handleSidebarChange(view) {
      // Update internal state to match sidebar selection
      this.sidebarContent = view;
    },
    handleSidebarAction(data) {
      switch (data.action) {
        case 'downloadHTML':
          this.downloadHTML();
          break;
        default:
          console.warn('Unknown sidebar button action:', data.action);
      }
    },
    downloadHTML() {
      if (this.$refs.editor && this.$refs.editor.downloadDocumentAsHTML) {
        // TODO: would prefer to move the function here
        this.$refs.editor.downloadDocumentAsHTML();
      }
    },
    handleSidebarVisibilityChange(visible) { 
      this.isSidebarVisible = visible;
    },
    onTemplatePreviewModeChange(isPreview) {
      if (!this.templateId) {
        return;
      }
      this.templatePreviewMode = !!isPreview;
      const sidebar = this.$refs.sidebar;
      if (!sidebar) {
        return;
      }
      if (this.templatePreviewMode) {
        if (sidebar.isSidebarVisible) {
          this.sidebarOpenBeforePreview = true;
          sidebar.toggleSidebar();
        }
      } else if (this.sidebarOpenBeforePreview && this.showTemplateConfigurator) {
        sidebar.toggleSidebar();
        this.sidebarOpenBeforePreview = false;
      }
    },

  },
};
</script>

<style scoped>
.container-fluid {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.row {
  display: flex;
  flex-direction: row;
  height: 100%;
}

.editor-container {
  flex: 1;
  overflow: hidden;
  min-width: 0;
}


</style>
