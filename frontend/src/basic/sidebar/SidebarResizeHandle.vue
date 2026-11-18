<template>
  <div
      id="hotZone"
      class="hot-zone"
      @mousedown="startDrag"
  ></div>
</template>

<script>
/**
 * Left edge of BasicSidebar: drag it to resize the sidebar between `min` and `max` pixels.
 *
 * @author Zheyu Zhang
 */
export default {
  name: "SidebarResizeHandle",
  props: {
    width: {
      type: Number,
      required: true,
    },
    min: {
      type: Number,
      required: true,
    },
    max: {
      type: Number,
      required: true,
    },
  },
  emits: ["drag-start", "update:width", "drag-end"],
  data() {
    return {
      startX: 0,
      startWidth: 0,
    };
  },
  beforeUnmount() {
    this.removeDragListeners();
  },
  methods: {
    startDrag(event) {
      this.$emit("drag-start");
      event.preventDefault();
      document.body.style.userSelect = 'none';
      this.startWidth = this.width;
      this.startX = event.clientX;
      document.addEventListener('mousemove', this.drag);
      document.addEventListener('mouseup', this.endDrag);
    },
    drag(event) {
      event.preventDefault();
      const width = this.startWidth - (event.clientX - this.startX);
      this.$emit("update:width", Math.min(Math.max(width, this.min), this.max));
    },
    endDrag() {
      this.removeDragListeners();
      document.body.style.userSelect = '';
      this.$emit("drag-end");
    },
    removeDragListeners() {
      document.removeEventListener('mousemove', this.drag);
      document.removeEventListener('mouseup', this.endDrag);
    },
  },
};
</script>

<style scoped src="./sidebar.css"></style>
