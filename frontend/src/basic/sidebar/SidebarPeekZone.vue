<template>
  <div
      id="hoverHotZone"
      @mouseenter="startPeekTimer"
      @mouseleave="cancelPeekTimer"
  ></div>
</template>

<script>
/**
 * Right window edge strip of a hidden BasicSidebar: resting the pointer on it for half a
 * second emits `peek`, so the sidebar can slide in.
 *
 * @author Zheyu Zhang
 */
export default {
  name: "SidebarPeekZone",
  emits: ["peek"],
  data() {
    return {
      peekTimer: null,
    };
  },
  beforeUnmount() {
    this.cancelPeekTimer();
  },
  methods: {
    startPeekTimer() {
      this.peekTimer = setTimeout(() => this.$emit("peek"), 500);
    },
    cancelPeekTimer() {
      clearTimeout(this.peekTimer);
    },
  },
};
</script>

<style scoped src="./sidebar.css"></style>
