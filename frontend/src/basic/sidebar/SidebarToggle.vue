<template>
  <Teleport to="#topBarNavItems">
    <li v-if="available" class="nav-item">
      <TopBarButton
          :show="show"
          :title="visible ? $t('navigation.sidebar.hideSidebar') : $t('navigation.sidebar.showSidebar')"
          class="btn rounded-circle"
          :class="{ 'sidebar-highlight': highlight }"
          @click="$emit('toggle')"
      >
        <LoadIcon
            :icon-name="visible ? 'layout-sidebar-inset-reverse' : 'layout-sidebar-reverse'"
            :size="18"
        />
      </TopBarButton>
    </li>
  </Teleport>
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";
import TopBarButton from "@/basic/navigation/TopBarButton.vue";
import debounce from "lodash.debounce";

/**
 * Top bar button that shows or hides BasicSidebar.
 *
 * Below 900px window width the sidebar collapses and this button flashes, so the user sees where
 * it went; widening the window again restores it. Window resizes are logged as stats.
 */
export default {
  name: "SidebarToggle",
  components: {LoadIcon, TopBarButton},
  inject: {
    studySessionId: {default: null},
    studyStepId: {default: null},
    documentId: {default: null},
    acceptStats: {default: false},
    currentStudyStep: {default: null},
  },
  props: {
    /** Whether the sidebar is open */
    visible: {
      type: Boolean,
      required: true,
    },
    /** Whether the button is rendered (the sidebar has a tab to show) */
    available: {
      type: Boolean,
      required: true,
    },
    /** Passed to TopBarButton */
    show: {
      type: Boolean,
      required: false,
      default: true,
    },
  },
  emits: ["toggle", "narrow"],
  data() {
    return {
      highlight: false,
      isNarrow: false,
      visibleBeforeNarrow: false,
      logResize: debounce(function (data) {
        if (this.acceptStats) this.$socket.emit("stats", {action: "sidebarResize", data});
      }, 500),
    };
  },
  mounted() {
    this.isNarrow = window.innerWidth <= 900;
    if (this.isNarrow) {
      this.visibleBeforeNarrow = this.visible;
      this.$emit("narrow", false, true);
    }
    window.addEventListener('resize', this.onResize);
  },
  beforeUnmount() {
    this.logResize.flush();
    window.removeEventListener('resize', this.onResize);
  },
  methods: {
    onResize() {
      // Only act when the width crosses 900px, so a sidebar the user opened or closed keeps its state
      const isNarrow = window.innerWidth <= 900;
      let visible = this.visible;
      if (isNarrow !== this.isNarrow) {
        this.isNarrow = isNarrow;
        if (isNarrow) {
          this.visibleBeforeNarrow = this.visible;
          visible = false;
          this.highlight = true;
          setTimeout(() => {
            this.highlight = false;
          }, 1000);
        } else {
          visible = this.visible || this.visibleBeforeNarrow;
        }
        this.$emit("narrow", visible, false);
      }

      // Log resize event with debouncing
      this.logResize({
        documentId: this.documentId, studySessionId: this.studySessionId, studyStepId: this.studyStepId,
        ...(this.currentStudyStep?.id ? {currentStudyStepId: this.currentStudyStep.id} : {}),
        windowWidth: window.innerWidth, sidebarVisible: visible,
      });
    },
  },
};
</script>

<style scoped src="./sidebar.css"></style>
