<template>
  <div class="look-back-spotlight" :style="{'--spot-y': spotY}"/>
</template>

<script>
/**
 * Spotlight on an earlier step's document while looking back
 *
 * Dims the document except a band at the mouse height, so the mouse tends to follow the eyes.
 * When the band rests on a part of the document for at least a second, that part is logged.
 *
 * @author Ilyas Mohammed
 */
export default {
  name: "LookBackSpotlight",
  inject: {
    acceptStats: {
      default: () => false
    },
    studySessionId: {
      type: Number,
      required: false,
      default: null,
    },
  },
  props: {
    // The earlier step whose document is shown
    step: {
      type: Object,
      required: true,
    },
    currentStepId: {
      type: Number,
      required: true,
    },
  },
  data() {
    return {
      // Above the pane means everything is dimmed
      spotY: "-200px",
      pane: null,
      rest: null,
    };
  },
  mounted() {
    this.pane = this.$el.parentElement;
    this.pane.addEventListener("pointermove", this.onMove);
    this.pane.addEventListener("pointerleave", this.onLeave);
    // Scrolling under a resting mouse moves the band to another part of the document
    this.pane.addEventListener("scroll", this.onScroll, true);
    // Leaving the browser tab means the eyes are elsewhere
    document.addEventListener("visibilitychange", this.endRest);
  },
  beforeUnmount() {
    this.endRest();
    this.pane.removeEventListener("pointermove", this.onMove);
    this.pane.removeEventListener("pointerleave", this.onLeave);
    this.pane.removeEventListener("scroll", this.onScroll, true);
    document.removeEventListener("visibilitychange", this.endRest);
  },
  methods: {
    onMove(event) {
      const y = event.clientY - this.pane.getBoundingClientRect().top;
      this.spotY = `${y}px`;
      // Small movements inside the band still count as resting on the same part
      if (this.rest && Math.abs(this.rest.clientY - event.clientY) < 105) {
        return;
      }
      this.endRest();
      this.startRest(event.clientY, event.target);
    },
    onLeave() {
      this.spotY = "-200px";
      this.endRest();
    },
    onScroll() {
      if (this.rest) {
        const {clientY, target} = this.rest;
        this.endRest();
        this.startRest(clientY, target);
      }
    },
    startRest(clientY, target) {
      this.rest = {clientY, target, part: this.partAt(clientY, target), start: Date.now()};
    },
    endRest() {
      if (!this.rest) {
        return;
      }
      const ms = Date.now() - this.rest.start;
      if (this.acceptStats && ms >= 1000 && this.rest.part !== null) {
        this.$socket.emit("stats", {
          action: "lookBackSpotlight",
          data: {
            documentId: this.step.documentId,
            stepId: this.step.id,
            part: this.rest.part,
            ms: ms,
            studySessionId: this.studySessionId,
            studyStepId: this.currentStepId,
          }
        });
      }
      this.rest = null;
    },
    // Where the band is in the whole document: 0 is the top, 1 the end
    partAt(clientY, target) {
      let element = target;
      while (element && element !== this.pane) {
        if (element.scrollHeight > element.clientHeight && ["auto", "scroll"].includes(getComputedStyle(element).overflowY)) {
          const y = element.scrollTop + clientY - element.getBoundingClientRect().top;
          return Math.round(y / element.scrollHeight * 100) / 100;
        }
        element = element.parentElement;
      }
      return null;
    },
  },
};
</script>

<style>
/* The pane holds the spotlight, which covers it without catching the mouse */
.study-pane:has(> .look-back-spotlight) {
  position: relative;
}

.look-back-spotlight {
  --spot-dim: rgba(0, 0, 0, 0.75);
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
  background: linear-gradient(to bottom,
    var(--spot-dim) calc(var(--spot-y) - 160px),
    transparent calc(var(--spot-y) - 105px),
    transparent calc(var(--spot-y) + 105px),
    var(--spot-dim) calc(var(--spot-y) + 160px));
}
</style>
