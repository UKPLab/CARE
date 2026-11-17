<template>
<div
    v-if="controller.isInfiniteMode && controller.total > 0 && controller.infiniteScrollbarVisible"
    :ref="el => controller.setViewRef('infiniteScrollbar', el)"
    class="infinite-scrollbar"
    role="scrollbar"
    :aria-valuemin="0"
    :aria-valuemax="Math.max(0, controller.total - 1)"
    :aria-valuenow="controller.visibleFirstRow"
    @mousedown.prevent="controller.onInfiniteScrollbarDown"
  >
    <div
      class="infinite-scrollbar-thumb"
      :style="infiniteThumbStyle"
    ></div>
  </div>
</template>
<script>


export default {
name:"BackendInfiniteScrollbar",
inject: { controller: { from: "backendTableController" } },
computed: {
infiniteThumbHeight() {
      const view = this.controller.viewportHeight || 1;
      const total = Math.max(1, this.controller.total);
      const visible = Math.min(total, Math.max(1, Math.round(view / this.controller.effectiveRowHeight)));
      return Math.max(32, (visible / total) * view);
    },
infiniteThumbStyle() {
      const view = this.controller.viewportHeight || 1;
      const thumb = this.infiniteThumbHeight;
      const maxTop = Math.max(0, view - thumb);
      const maxFirst = Math.max(1, this.controller.total - Math.round(view / this.controller.effectiveRowHeight));
      const index = this.controller.thumbFraction != null
        ? this.controller.rowIndexForFraction(this.controller.thumbFraction)
        : (this.controller.pinnedRow != null ? this.controller.pinnedRow : this.controller.visibleFirstRow);
      const fraction = maxFirst > 0 ? index / maxFirst : 0;
      return {
        height: `${thumb}px`,
        top: `${Math.max(0, Math.min(maxTop, fraction * maxTop))}px`,
      };
    }
},
methods: {
onInfiniteScrollbarDown(event) {
      const track = this.controller.tableRefs.infiniteScrollbar;
      const wrapper = this.controller.tableRefs.tableWrapper;
      if (!track || !wrapper) return;
      const rect = track.getBoundingClientRect();
      const thumb = this.infiniteThumbHeight;
      const maxTop = Math.max(0, rect.height - thumb);
      const y = event.clientY - rect.top - thumb / 2;
      this.controller.previewThumb(Math.max(0, Math.min(maxTop, y)), maxTop);
      this.controller.thumbDrag = {
        maxTop,
        offset: thumb / 2,
        rectTop: rect.top,
      };
      this.controller.onThumbMove = (moveEvent) => {
        if (!this.controller.thumbDrag) return;
        const next = moveEvent.clientY - this.controller.thumbDrag.rectTop - this.controller.thumbDrag.offset;
        this.controller.previewThumb(
          Math.max(0, Math.min(this.controller.thumbDrag.maxTop, next)),
          this.controller.thumbDrag.maxTop
        );
      };
      this.controller.onThumbUp = () => this.controller.stopInfiniteThumbDrag();
      window.addEventListener("mousemove", this.controller.onThumbMove);
      window.addEventListener("mouseup", this.controller.onThumbUp);
    },
previewThumb(thumbTop, maxTop) {
      const fraction = maxTop > 0 ? thumbTop / maxTop : 0;
      const target = this.controller.rowIndexForFraction(fraction);
      const visible = Math.max(1, Math.round((this.controller.viewportHeight || 1) / this.controller.effectiveRowHeight));
      this.controller.thumbFraction = fraction;
      this.controller.pinnedRow = target;
      this.controller.visibleFirstRow = target;
      this.controller.visibleLastRow = Math.min(Math.max(0, this.controller.total - 1), target + visible - 1);
      const outside = target < this.controller.rowsBefore || target >= this.controller.rowsBefore + this.controller.loadedCount;
      const wrapper = this.controller.tableRefs.tableWrapper;
      if (outside && wrapper) {
        this.controller.suppressScroll = true;
        wrapper.scrollTop = 0;
      }
    },
commitThumbFraction() {
      const fraction = this.controller.thumbFraction;
      this.controller.thumbFraction = null;
      if (fraction == null || !this.controller.total) return;
      const target = this.controller.rowIndexForFraction(fraction);
      const visible = Math.max(1, Math.round((this.controller.viewportHeight || 1) / this.controller.effectiveRowHeight));
      this.controller.pinnedRow = target;
      this.controller.visibleFirstRow = target;
      this.controller.visibleLastRow = Math.min(Math.max(0, this.controller.total - 1), target + visible - 1);
      const windowStart = this.controller.rowsBefore;
      const windowEnd = windowStart + this.controller.loadedCount;
      if (target >= windowStart && target < windowEnd) {
        this.controller.pinnedRow = null;
        this.controller.windowHold = false;
        this.controller.scrollToRowIndex(target);
        this.controller.scheduleVirtualUpdate();
        return;
      }
      this.controller.windowHold = true;
      this.controller.scheduleWindowSeek(target);
    },
stopInfiniteThumbDrag() {
      this.controller.commitThumbFraction();
      if (this.controller.onThumbMove) {
        window.removeEventListener("mousemove", this.controller.onThumbMove);
      }
      if (this.controller.onThumbUp) {
        window.removeEventListener("mouseup", this.controller.onThumbUp);
      }
      this.controller.thumbDrag = null;
      this.controller.onThumbMove = null;
      this.controller.onThumbUp = null;
    },
rowIndexForFraction(fraction) {
      const visible = Math.max(1, Math.round((this.controller.viewportHeight || 1) / this.controller.effectiveRowHeight));
      const maxFirst = Math.max(0, this.controller.total - visible);
      return Math.round(Math.max(0, Math.min(1, fraction)) * maxFirst);
    },
scrollToRowIndex(index) {
      const wrapper = this.controller.tableRefs.tableWrapper;
      if (!wrapper) return;
      const row = Math.max(0, Math.min(index, Math.max(0, this.controller.total - 1)));
      this.controller.suppressScroll = true;
      wrapper.scrollTop = row * this.controller.effectiveRowHeight;
    },
firstVisibleRowId() {
      if (!this.controller.loadedCount) return null;
      const local = Math.max(0, Math.min(this.controller.loadedCount - 1, this.controller.visibleFirstRow - this.controller.rowsBefore));
      const row = this.controller.queryItems[local];
      return row ? row.id : null;
    },
isRowIndexVisible(localIndex) {
      if (localIndex < 0) return false;
      const global = this.controller.rowsBefore + localIndex;
      return global >= this.controller.visibleFirstRow && global <= this.controller.visibleLastRow;
    },
isRowIndexAboveViewport(localIndex) {
      if (localIndex < 0) return false;
      return this.controller.rowsBefore + localIndex < this.controller.visibleFirstRow;
    },
rowBelongsInWindow(row) {
      if (!this.controller.loadedCount) return false;
      return !this.controller.isBeforeAnchor(row) && !this.controller.isAfterCurrentPage(row);
    },
windowInsertIndex(row) {
      const sort = this.controller.currentQuery?.sort;
      if (!sort?.column) return this.controller.queryItems.length;
      const direction = sort.direction || "ASC";
      for (let i = 0; i < this.controller.queryItems.length; i += 1) {
        const other = this.controller.queryItems[i];
        const cmp = this.controller.compareSort(row[sort.column], other[sort.column], direction);
        if (cmp < 0 || (cmp === 0 && this.controller.compareSort(row.id, other.id, "ASC") < 0)) {
          return i;
        }
      }
      return this.controller.queryItems.length;
    },
trimWindowFarEdge() {
      const overflow = this.controller.queryItems.length - this.controller.infiniteMaxRows;
      if (overflow <= 0) return;
      const aboveViewport = Math.max(0, this.controller.visibleFirstRow - this.controller.rowsBefore);
      const belowViewport = Math.max(0, (this.controller.rowsBefore + this.controller.queryItems.length - 1) - this.controller.visibleLastRow);
      if (aboveViewport >= belowViewport) {
        this.controller.queryItems = this.controller.queryItems.slice(overflow);
        this.controller.rowsBefore += overflow;
        this.controller.windowStartCursorValid = false;
      } else {
        this.controller.queryItems = this.controller.queryItems.slice(0, this.controller.queryItems.length - overflow);
        this.controller.windowEndCursorValid = false;
      }
    },
flashEnteringRow(id) {
      this.controller.enteringIds = [...this.controller.enteringIds.filter((x) => x !== id), id];
      clearTimeout(this.controller.enteringClearTimer);
      this.controller.enteringClearTimer = setTimeout(() => {
        this.controller.enteringIds = [];
        this.controller.enteringBottomIds = [];
      }, 1200);
    },
insertWindowRow(row) {
      const enriched = this.controller.applyEnrich(row);
      const index = this.controller.windowInsertIndex(enriched);
      const above = this.controller.isRowIndexAboveViewport(index);
      const next = [...this.controller.queryItems];
      next.splice(index, 0, enriched);
      this.controller.queryItems = next;
      this.controller.trimWindowFarEdge();
      const localIndex = this.controller.queryItems.findIndex((item) => item.id === enriched.id);
      if (this.controller.isRowIndexVisible(localIndex)) {
        this.controller.flashEnteringRow(enriched.id);
      } else if (above) {
        this.controller.shiftScrollForRows(1);
      }
      this.controller.syncWindowQuery();
      this.controller.scheduleVirtualUpdate();
    },
removeWindowRow(id, index = -1) {
      const at = index >= 0 ? index : this.controller.queryItems.findIndex((item) => item.id === id);
      if (at < 0) return;
      const above = this.controller.isRowIndexAboveViewport(at);
      const next = [...this.controller.queryItems];
      next.splice(at, 1);
      this.controller.queryItems = next;
      if (above) this.controller.shiftScrollForRows(-1);
      this.controller.syncWindowQuery();
      this.controller.scheduleVirtualUpdate();
    },
finishInfiniteDeletes() {
      if (this.controller.deletingIds && this.controller.deletingIds.size > 0) {
        this.controller.schedulePageBackfill();
        return;
      }
      const placeholders = this.controller.placeholderIds || new Set();
      if (!placeholders.size) return;
      let removedAbove = 0;
      this.controller.queryItems.forEach((row, index) => {
        if (placeholders.has(row.id) && this.controller.isRowIndexAboveViewport(index)) {
          removedAbove += 1;
        }
      });
      this.controller.queryItems = this.controller.queryItems.filter((row) => !placeholders.has(row.id));
      this.controller.placeholderIds = new Set();
      if (removedAbove) this.controller.shiftScrollForRows(-removedAbove);
      this.controller.syncWindowQuery();
      this.controller.scheduleVirtualUpdate();
    }
}
};
</script>

<style scoped>
.infinite-scrollbar {
  flex: 0 0 14px;
  position: relative;
  margin-left: 6px;
  background: #dee2e6;
  border: 1px solid #ced4da;
  border-radius: 8px;
  cursor: pointer;
}
.infinite-scrollbar-thumb {
  position: absolute;
  left: 2px;
  right: 2px;
  background: #6c757d;
  border-radius: 6px;
}
.infinite-scrollbar-thumb:hover {
  background: #495057;
}
.infinite-scrollbar:active .infinite-scrollbar-thumb,
.infinite-scrollbar-thumb:active {
  background: #343a40;
}
</style>
