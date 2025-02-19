<template>
  <div class="container-fluid d-flex min-vh-100 vh-100 flex-column">
    <div class="row flex-grow-1 overflow-hidden">
      <div id="editorContainer" class="editor-container flex-grow-1">
        <Editor ref="editor" :document-id="documentId" :study-step-id="studyStepId" :active="!sidebarDisabled"/>
      </div>
      <Sidebar
        v-if="!sidebarDisabled && sidebarContent !== null"
        ref="sidebar"
        :content="sidebarContent"
        class="sidebar-container"/>
    </div>
  </div>
  <Teleport to="#topBarNavItems">
    <TopBarButton
      v-if="showHistory"
      title="Show History"
      class="btn rounded-circle ms-2"
      type="button"
      @click="toogleHistory"
    >
      <LoadIcon
        :color="'#777777'"
        :size="18"
        icon-name="clock-history"
      />
    </TopBarButton>
  </Teleport>

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
 * @autor Dennis Zyska, Juliane Bechert
 */
import Sidebar from "@/components/editor/sidebar/History.vue";
import Editor from "@/components/editor/editor/Editor.vue";
import TopBarButton from "@/basic/navigation/TopBarButton.vue";
import LoadIcon from "@/basic/Icon.vue";
import {computed} from "vue";

export default {
  name: "EditorView",
  components: {
    LoadIcon, TopBarButton,
    Sidebar,
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
  },

  data() {
    return {
      isSidebarVisible: false,
      sidebarContent: null,
    };
  },
  computed: {
    isAdmin() {
      return this.$store.getters['auth/isAdmin'];
    },
    readOnlyOverwrite() {
      if (this.sidebarContent === 'history') {
        return true;
      }
      return this.readOnly;
    },
    showHistory() {
      const showHistoryForUser = this.$store.getters["settings/getValue"]('editor.edits.showHistoryForUser') === "true";
      if (this.isAdmin || showHistoryForUser) {
        return true;
      }
      return false;
    },
  },
  methods: {
    toogleHistory() {
      if (this.sidebarContent === 'history') {
        this.sidebarContent = null;
      } else {
        this.sidebarContent = 'history';
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
    },
    leave() {
      return this.$refs.editor.leave();
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
  width:350px;
  max-width: 350px;
  min-width: 350px;
  background-color: #f8f9fa;
  border-left: 1px solid #ddd;
  overflow-y: auto;
  margin-top: 60px;
}
</style>
