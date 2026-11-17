<template>
<div
                    class="cell-scroll"
                    :style="controller.getScrollCellStyle(column)"
                    @mouseenter="syncNameScrollBar"
                  >
                    <div
                      class="cell-scroll-content"
                      @scroll="syncNameScrollBar"
                      @wheel.prevent="onCellScrollWheel"
                    >
                      {{ row[column.key] }}
                    </div>
                    <div
                      class="cell-scroll-track"
                      @mousedown.prevent.stop="onNameScrollBarDown"
                    >
                      <div class="cell-scroll-thumb"></div>
                    </div>
                  </div>
</template>
<script>


export default {
name:"BackendCellScrolling",
inject: { controller: { from: "backendTableController" } },
props: { column: { type: Object, required: true }, row: {type:Object,required:true} },
methods: {
onCellScrollWheel(event) {
      const content = event.currentTarget;
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        const target = this.controller.tableRefs.tableWrapper;
        if (target) target.scrollTop += event.deltaY;
        return;
      }
      content.scrollLeft += event.deltaX || event.deltaY;
    },
nameScrollRoot(el) {
      return el?.classList?.contains("cell-scroll") ? el : el?.closest?.(".cell-scroll");
    },
syncNameScrollBar(event) {
      const root = this.nameScrollRoot(event.currentTarget);
      if (!root) return;
      const content = root.querySelector(".cell-scroll-content");
      const thumb = root.querySelector(".cell-scroll-thumb");
      if (!content || !thumb) return;
      const {scrollWidth, clientWidth, scrollLeft} = content;
      if (scrollWidth <= clientWidth + 1) {
        root.classList.remove("is-overflow");
        return;
      }
      root.classList.add("is-overflow");
      const thumbW = Math.max(12, (clientWidth / scrollWidth) * clientWidth);
      const maxLeft = Math.max(0, clientWidth - thumbW);
      const left = (scrollWidth - clientWidth) > 0
        ? (scrollLeft / (scrollWidth - clientWidth)) * maxLeft
        : 0;
      thumb.style.width = `${thumbW}px`;
      thumb.style.transform = `translateX(${left}px)`;
    },
onNameScrollBarDown(event) {
      const track = event.currentTarget;
      const root = this.nameScrollRoot(track);
      const content = root?.querySelector(".cell-scroll-content");
      const thumb = track.querySelector(".cell-scroll-thumb");
      if (!root || !content || !thumb) return;
      this.syncNameScrollBar({currentTarget: root});
      const rect = track.getBoundingClientRect();
      const thumbW = thumb.offsetWidth || 12;
      const maxLeft = Math.max(0, rect.width - thumbW);
      const apply = (clientX) => {
        const x = Math.max(0, Math.min(maxLeft, clientX - rect.left - thumbW / 2));
        const maxScroll = Math.max(0, content.scrollWidth - content.clientWidth);
        content.scrollLeft = maxLeft > 0 ? (x / maxLeft) * maxScroll : 0;
      };
      apply(event.clientX);
      root.classList.add("is-dragging");
      const move = (e) => apply(e.clientX);
      const up = () => {
        root.classList.remove("is-dragging");
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    }
}
};
</script>

<style scoped>
.cell-scroll {
  display: block;
  max-width: 100%;
  position: relative;
}
.cell-scroll-content {
  overflow-x: auto;
  overflow-y: hidden;
  white-space: nowrap;
  padding-bottom: 10px;
  scrollbar-width: none;
}
.cell-scroll-content::-webkit-scrollbar {
  display: none;
  height: 0;
}
.cell-scroll-track {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 12px;
  background: transparent;
  border-radius: 2px;
  opacity: 0;
  pointer-events: none;
  cursor: pointer;
}
.cell-scroll-track::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 3px;
  height: 3px;
  background: #dee2e6;
  border-radius: 2px;
}
.cell-scroll.is-overflow:hover .cell-scroll-track,
.cell-scroll.is-dragging .cell-scroll-track {
  opacity: 1;
  pointer-events: auto;
}
.cell-scroll-thumb {
  position: relative;
  height: 12px;
  background: transparent;
  will-change: transform;
}
.cell-scroll-thumb::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 3px;
  height: 3px;
  background: #6c757d;
  border-radius: 2px;
}
.cell-scroll.is-overflow:hover .cell-scroll-thumb:hover::after {
  background: #495057;
}
.cell-scroll.is-dragging .cell-scroll-thumb::after {
  background: #343a40;
}
</style>
