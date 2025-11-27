<template>
  <div class="container-fluid d-flex min-vh-100 vh-100 flex-column">
    <div class="row flex-grow-1 overflow-hidden">
      <div id="editorContainer" class="editor-container flex-grow-1">
        <Editor ref="editor" @update:data="$emit('update:data', $event)"/>
      </div>
      <BasicSidebar
          v-if="!sidebarDisabled && defaultActiveSidebar && studySessionId === null"
          ref="sidebar"
          :buttons="sidebarButtons"
          :side-bar-width="350"
          :active-side-bar="defaultActiveSidebar"
          class="sidebar-container"
          :show-toggle-button="true"
          @sidebar-change="handleSidebarChange"
          @sidebar-visibility-change="handleSidebarVisibilityChange"
          @sidebar-action="handleSidebarAction">
        <template v-if="showHistory && !withoutHistory" #history>
          <SidebarTemplate icon="clock-history" title="History">
            <template #content>
              <SidebarHistory/>
            </template>
          </SidebarTemplate>
        </template>
        <template v-if="document && document.type === 2" #configurator>
          <SidebarTemplate icon="gear-fill" title="Configurator">
            <template #content>
              <SidebarConfigurator/>
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
  <Teleport to="#topbarCenterPlaceholder">
    <div
        v-show="readOnlyOverwrite"
        title="Read-only"
    >
      <span
          :style="{ color: '#800000', fontWeight: 'bold' }"
      >
        Read-only
      </span>
      <LoadIcon
          :size="22"
          :color="'#800000'"
          icon-name="lock-fill"
      />
    </div>

  </Teleport>

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

export default {
  name: "EditorView",
  components: {
    SidebarTemplate,
    SidebarConfigurator,
    SidebarHistory,
    LoadIcon,
    BasicSidebar,
    Editor,
  },
  provide() {
    return {
      documentId: computed(() => this.documentId),
      studyStepId: computed(() => this.studyStepId),
      readOnly: computed(() => this.readOnlyOverwrite),
    }
  },
  inject: {
    readOnly: {
      type: Boolean,
      required: false,
      default: false,
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
      required: true,
      default: 0,
    },
    sidebarDisabled: {
      type: Boolean,
      required: false,
      default: false,
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
      return null;
    },
    sidebarButtons() {
      return [
        {
          id: 'download-html',
          icon: 'download',
          title: 'Download document',
          action: 'downloadHTML',
          isGeneral: true,
          disabled: !this.showHTMLDownloadButton
        }
      ];
    },
    showHTMLDownloadButton() {
      return this.$store.getters["settings/getValue"]("editor.toolbar.showHTMLDownload") === "true";
    },
    readOnlyOverwrite() {
      if (this.sidebarContent === 'history' ) {
        return this.isSidebarVisible;
      }
      return this.readOnly;
    },
    showHistory() {
      if (this.readOnly) {
        return false;
      }
      const showHistoryForUser = this.$store.getters["settings/getValue"]('editor.edits.showHistoryForUser') === "true";
      return this.isAdmin || showHistoryForUser;
    },
    document() {
      return this.$store.getters["table/document/get"](this.documentId);
    },
  },
  methods: {
    addText(text) {
      this.$refs.editor.addText(text);
    },
    isEditorEmpty() {
      return this.$refs.editor.isEditorEmpty();
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
                  title: "Failed retrieving edit history",
                  message: res.message,
                  variant: "danger",
                });
              }
            }
        );
      }
    }
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
