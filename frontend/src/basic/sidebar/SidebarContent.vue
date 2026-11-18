<template>
  <div class="sidebar-content">
    <template v-for="slotName in slotNames" :key="slotName">
      <keep-alive>
        <div v-show="activeSlot === slotName" :data-sidebar-slot="slotName">
          <slot :name="slotName"/>
        </div>
      </keep-alive>
    </template>
  </div>
</template>

<script>
/**
 * Tab panes of BasicSidebar: every slot stays rendered, only the active one is shown.
 * Logs as stats how long each pane was on screen.
 */
export default {
  name: "SidebarContent",
  inject: {
    studySessionId: {default: null},
    studyStepId: {default: null},
    documentId: {default: null},
    acceptStats: {default: false},
    currentStudyStep: {default: null},
  },
  props: {
    slotNames: {
      type: Array,
      required: true,
    },
    activeSlot: {
      type: String,
      required: false,
      default: null,
    },
    /** Whether the sidebar is on screen (shown and opened) */
    viewed: {
      type: Boolean,
      required: true,
    },
  },
  data() {
    return {
      activeSlotStartedAt: null,
      activeSlotName: null,
      activeSlotContext: null,
    };
  },
  computed: {
    /** The pane on screen, if any */
    viewedSlot() {
      return this.viewed ? this.activeSlot : null;
    },
  },
  watch: {
    // Includes programmatic tab changes, the fallback when a tab becomes hidden, and showing or hiding the sidebar.
    viewedSlot() {
      this.logSidebarSlotDuration();
      this.startSidebarSlotTimer();
    },
    currentStudyStep() {
      this.logSidebarSlotDuration();
      this.startSidebarSlotTimer();
    },
    studySessionId() {
      this.logSidebarSlotDuration();
      this.startSidebarSlotTimer();
    },
  },
  mounted() {
    this.startSidebarSlotTimer();
  },
  beforeUnmount() {
    this.logSidebarSlotDuration();
  },
  methods: {
    /**
     * Starts measuring time spent on the active sidebar slot.
     *
     * @returns {void}
     */
    startSidebarSlotTimer() {
      if (this.activeSlotStartedAt !== null) return;
      this.activeSlotName = this.viewedSlot;
      this.activeSlotStartedAt = this.activeSlotName ? Date.now() : null;
      this.activeSlotContext = this.activeSlotName ? {
        documentId: this.documentId, studySessionId: this.studySessionId, studyStepId: this.studyStepId,
        ...(this.currentStudyStep?.id ? {currentStudyStepId: this.currentStudyStep.id} : {}),
      } : null;
    },
    /**
     * Logs time spent on the active sidebar slot.
     *
     * @returns {void}
     */
    logSidebarSlotDuration() {
      const startedAt = this.activeSlotStartedAt;
      const slotName = this.activeSlotName;
      const context = this.activeSlotContext;
      this.activeSlotStartedAt = null;
      this.activeSlotName = null;
      this.activeSlotContext = null;
      if (!this.acceptStats || startedAt === null || !slotName) return;
      const durationMs = Date.now() - startedAt;
      if (durationMs <= 0) return;
      this.$socket.emit("stats", {
        action: "sidebarSlotDuration",
        data: {
          ...context,
          slotName,
          durationMs,
        }
      });
    },
  },
};
</script>

<style scoped src="./sidebar.css"></style>
