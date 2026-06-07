<template>
  <Teleport to="#topbarCenterPlaceholder">
  <div
    v-show="templateId && readOnlyOverwrite"
    :title="$t('common.readOnly')"
  >
    <span :style="{ color: '#800000', fontWeight: 'bold' }">
      {{ $t('common.readOnly') }}
    </span>
    <LoadIcon
      :size="22"
      :color="'#800000'"
      icon-name="lock-fill"
    />
  </div>
</Teleport>
  <div class="container-fluid d-flex min-vh-100 vh-100 flex-column">
    <div class="row flex-grow-1 overflow-hidden">
      <div id="editorContainer" class="editor-container flex-grow-1">
        <Editor v-if="!templateId" ref="editor" @update:data="$emit('update:data', $event)"/>
        <TemplateEditor v-else ref="templateEditor" @update:data="$emit('update:data', $event)"/>
      </div>
      <BasicSidebar
          v-if="!sidebarDisabled"
          ref="sidebar"
          :is-shown="isShown"
          :buttons="sidebarButtons"
          :side-bar-width="350"
          :active-side-bar="defaultActiveSidebar"
          class="sidebar-container"
          :show-toggle-button="true"
          @sidebar-change="handleSidebarChange"
          @sidebar-visibility-change="handleSidebarVisibilityChange"
          @sidebar-action="handleSidebarAction">
        <template v-if="showHistory && !withoutHistory" #history>
          <SidebarTemplate icon="clock-history" :title="$t('editor.history')">
            <template #content>
              <SidebarHistory/>
            </template>
          </SidebarTemplate>
        </template>
        <template v-if="document && document.type === 2" #configurator>
          <SidebarTemplate icon="gear-fill" :title="$t('editor.configurator')">
            <template #content>
              <SidebarConfigurator/>
            </template>
          </SidebarTemplate>
        </template>
        <template v-if="templateId && template && !readOnlyOverwrite && hasPlaceholders" #templateConfigurator>
          <SidebarTemplate icon="gear-fill" :title="$t('editor.placeholders')">
            <template #content>
              <TemplateConfigurator/>
            </template>
          </SidebarTemplate>
        </template>
        <!-- Pass through all additional slots directly to BasicSidebar -->
        <template v-for="(slot, slotName) in $slots" :key="slotName" #[slotName]>
          <slot v-if="slotName !== 'default'" :name="slotName"/>
        </template>
      </BasicSidebar>
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
import BasicSidebar from "@/basic/Sidebar.vue";
import Editor from "@/components/editor/editor/Editor.vue";
import SidebarHistory from "@/components/editor/sidebar/History.vue";
import SidebarConfigurator from "@/components/editor/sidebar/Configurator.vue";
import LoadIcon from "@/basic/Icon.vue";
import {computed} from "vue";
import SidebarTemplate from "@/basic/sidebar/SidebarTemplate.vue";
import TemplateEditor from "@/components/editor/template/TemplateEditor.vue";
import TemplateConfigurator from "@/components/editor/sidebar/TemplateConfigurator.vue";
import { resolveApiMessage } from "@/assets/utils";

export default {
  name: "EditorView",
  subscribeTable: ["template"],
  components: {
    SidebarTemplate,
    SidebarConfigurator,
    SidebarHistory,
    LoadIcon,
    BasicSidebar,
    Editor,
    TemplateEditor,
    TemplateConfigurator,
  },
  provide() {
    return {
      documentId: computed(() => this.documentId),
      studyStepId: computed(() => this.studyStepId),
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
      hasHistory: false,
      sidebarContent: null,
    };
  },
  computed: {
    isAdmin() {
      return this.$store.getters['auth/isAdmin'];
    },
    defaultActiveSidebar() {
      // Determine the default active sidebar based on available tabs
      if (this.document && this.document.type === 2) {
        return 'configurator';
      }
      // Only show template configurator if template is loaded, not read-only, and has placeholders
      // Document templates (types 4, 5) have no placeholders, so no sidebar needed
      if (this.templateId && this.template && !this.readOnlyOverwrite && this.hasPlaceholders) {
        return 'templateConfigurator';
      }
      return null;
    },
    sidebarButtons() {
      // Don't show download button for templates
      if (this.templateId) {
        return [];
      }
      return [
        {
          id: 'download-html',
          icon: 'download',
          title: this.$t('editor.downloadDocument'),
          action: 'downloadHTML',
          isGeneral: true,
          disabled: !this.showHTMLDownloadButton
        }
      ];
    },
    showHTMLDownloadButton() {
      return this.$store.getters["settings/getValue"]("editor.toolbar.showHTMLDownload") === "true";
    },
    template() {
      if (this.templateId && this.templateId > 0) {
        return this.$store.getters["table/template/get"](Number(this.templateId));
      }
      return null;
    },
    hasPlaceholders() {
      // Only email templates (types 1, 2, 3, 6, 7) have placeholders
      // Document templates (types 4, 5) have no placeholders
      if (!this.template) return false;
      return [1, 2, 3, 6, 7].includes(this.template.type);
    },
    readOnlyOverwrite() {
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
    showHistory() {
      if (this.readOnly || this.templateId) {
        return false;
      }
      const showHistoryForUser = this.$store.getters["settings/getValue"]('editor.edits.showHistoryForUser') === "true";
      return this.isAdmin || showHistoryForUser;
    },
    document() {
      if (this.documentId && this.documentId > 0) {
        return this.$store.getters["table/document/get"](this.documentId);
      }
      return null;
    },
  },
  methods: {
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
      if (view === 'history') {
        this.toggleHistory();
      }
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
    toggleHistory() {
      if (this.hasHistory) {
        this.hasHistory = false;
      } else {
        this.hasHistory = true;
        this.$socket.emit(
            "documentGet",
            {
              documentId: this.documentId,
              studySessionId: this.studySessionId,
              studyStepId: this.studyStepId,
              history: true,
            },
            (res) => {
              if (!res.success) {
                this.eventBus.emit("toast", {
                  title: this.$t('errors.editor.editHistoryRetrievalFailed'),
                  message: resolveApiMessage(res),
                  variant: "danger",
                });
              }
            }
        );
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

.sidebar-container {
  margin-top: 60px;
}
</style>
