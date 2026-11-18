<template>
      <BasicSidebar
          ref="sidebar"
          :is-shown="isShown"
          :buttons="sidebarButtons"
          :side-bar-width="350"
          :active-side-bar="activeSidebar || defaultActiveSidebar"
          :is-tab-shown="isSidebarTabShown"
          :is-tab-current="isSidebarTabCurrent"
          :default-visible="!!defaultActiveSidebar"
          class="sidebar-container"
          :show-toggle-button="true"
          @sidebar-change="onSidebarChange"
          @sidebar-visibility-change="$emit('sidebar-visibility-change', $event)"
          @sidebar-action="$emit('sidebar-action', $event)">
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
        <template v-if="showTemplateConfigurator" #templateConfigurator>
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
</template>

<script>
import BasicSidebar from "@/basic/Sidebar.vue";
import SidebarTemplate from "@/basic/sidebar/SidebarTemplate.vue";
import SidebarHistory from "./History.vue";
import SidebarConfigurator from "./Configurator.vue";
import TemplateConfigurator from "./TemplateConfigurator.vue";
import {resolveApiMessage} from "@/assets/utils";
import {isCurrentStepTab, isLookBackTabShown, lookBackPaneProps} from "@/components/study/helpers/lookBack.js";

export default {
  name: 'EditorSidebar',
  components: {BasicSidebar, SidebarTemplate, SidebarHistory, SidebarConfigurator, TemplateConfigurator},
  inject: {documentId: {default: 0}, studyStepId: {default: null}, studySessionId: {default: null}},
  props: {
    document: {type: Object, default: null},
    templateId: {type: Number, default: 0},
    readOnly: {type: Boolean, default: false},
    withoutHistory: {type: Boolean, default: false},
    isShown: {type: Boolean, default: true},
    showTemplateConfigurator: {type: Boolean, default: false},
    ...lookBackPaneProps,
  },
  emits: ['sidebar-change', 'sidebar-visibility-change', 'sidebar-action'],
  data() { return {hasHistory: false}; },
  computed: {
    isSidebarVisible() { return this.$refs.sidebar?.isSidebarVisible || false; },
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
      if (this.showTemplateConfigurator) {
        return 'templateConfigurator';
      }
      if (this.$slots.additionalSidebars) {
        return 'additionalSidebars';
      }
      if (this.$slots.aiConversation) {
        return 'aiConversation';
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
showHistory() {
      if (this.readOnly || this.templateId) {
        return false;
      }
      const showHistoryForUser = this.$store.getters["settings/getValue"]('editor.edits.showHistoryForUser') === "true";
      return this.isAdmin || showHistoryForUser;
    }
  },
  methods: {
    toggleSidebar() { this.$refs.sidebar?.toggleSidebar(); },
    onSidebarChange(view) {
      this.$emit('sidebar-change', view);
      if (view === 'history') this.toggleHistory();
    },
isSidebarTabShown(slotName) {
      return isLookBackTabShown(slotName, this.lookBackTabs, this.shownLookBackStepId, this.ownTabsHidden);
    },
isSidebarTabCurrent(slotName) {
      return isCurrentStepTab(slotName, this.lookBackTabs);
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
    }
  },
};
</script>

<style scoped>
.sidebar-container { margin-top: 60px; min-height: 0; align-self: stretch; }
</style>
