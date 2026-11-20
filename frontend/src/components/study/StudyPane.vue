<template>
  <!-- The pane itself, not a wrapper: the split layout in PaneStrip.vue styles the panes as direct children -->
  <div @mouseover="mouseOver" @mouseleave="setInside(false)" @click="click">
    <slot/>
    <div v-if="showLabel" class="pane-label-holder">
      <span class="badge d-inline-flex align-items-center gap-1">
        <LoadIcon v-if="step.id !== currentStudyStep?.id" icon-name="lock-fill" :size="10"/>
        {{ label }}
      </span>
    </div>
  </div>
</template>

<script>
/**
 * One study step's pane in Study.vue, with the step's name on it while the workflow bar is open.
 * While an earlier step is on screen, it logs when the mouse enters and leaves the pane's document and clicks in it,
 * so the time a student spends in each document can be measured. The sidebar is not part of the document.
 *
 * @author Ilyas Mohammed
 */
import LoadIcon from "@/basic/Icon.vue";

export default {
  name: "StudyPane",
  components: {LoadIcon},
  inject: {
    acceptStats: {
      default: () => false
    },
    studySessionId: {
      type: Number,
      required: false,
      default: null,
    },
    currentStudyStep: {
      type: Object,
      required: false,
      default: null,
    },
  },
  props: {
    step: {
      type: Object,
      required: true,
    },
    // The step's name, as on the workflow bar
    label: {
      type: String,
      required: true,
    },
    showLabel: {
      type: Boolean,
      default: false,
    },
    // Whether to log the mouse in this pane: only while an earlier step is on screen and this pane is shown
    trackMouse: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      isInside: false,
      // The study IDs at the moment the mouse entered, also sent when it leaves, so both events match
      insideContext: null,
    };
  },
  watch: {
    trackMouse(track) {
      // A pane that is hidden or no longer tracked ends the time the mouse was inside
      if (!track) {
        this.setInside(false);
      }
    },
  },
  mounted() {
    // Going to another window or browser tab ends the time in the document too: the student is not looking at it
    window.addEventListener("blur", this.leavePage);
    document.addEventListener("visibilitychange", this.leavePage);
  },
  beforeUnmount() {
    window.removeEventListener("blur", this.leavePage);
    document.removeEventListener("visibilitychange", this.leavePage);
    this.setInside(false);
  },
  methods: {
    leavePage() {
      // Focus that moves inside the page (e.g. into a frame) keeps it
      if (document.hidden || !document.hasFocus()) {
        this.setInside(false);
      }
    },
    mouseOver(event) {
      this.setInside(!event.target.closest("#sidebarContainer"));
    },
    // Logged like pdfPageVisibilityChange: the time between inside and outside is the time spent in the document
    setInside(isInside) {
      if ((isInside && !this.trackMouse) || isInside === this.isInside) {
        return;
      }
      this.isInside = isInside;
      if (isInside) {
        this.insideContext = this.studyContext();
      }
      this.sendStats("studyPaneMouseChange", {isInside, ...this.insideContext});
    },
    click(event) {
      if (this.trackMouse && !event.target.closest("#sidebarContainer")) {
        this.sendStats("studyPaneClick", this.studyContext());
      }
    },
    studyContext() {
      return {
        ...(this.studySessionId ? {studySessionId: this.studySessionId} : {}),
        ...(this.currentStudyStep?.id ? {currentStudyStepId: this.currentStudyStep.id} : {}),
      };
    },
    sendStats(action, data) {
      if (this.acceptStats) {
        this.$socket.emit("stats", {
          action,
          data: {documentId: this.step.documentId, studyStepId: this.step.id, ...data},
        });
      }
    },
  },
}
</script>
