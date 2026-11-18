<template><div
    class="table-scroll-shell"
    :class="{ 'table-infinite-shell': controller.isInfiniteMode }"
  >
  <div :class="{ 'table-infinite-main': controller.isInfiniteMode }">
  <div
    :ref="el => controller.setViewRef('tableWrapper', el)"
    class="table-wrapper"
    :class="{
      'pending-load-out': controller.pendingLoadPhase === 'out',
      'pending-load-in': controller.pendingLoadPhase === 'in',
      'table-infinite': controller.isInfiniteMode,
    }"
    :style="controller.tableWrapperStyle"
  >
    <table
      :ref="el => controller.setViewRef('tableElement', el)"
      :class="[controller.tableClass, { 'table-virtual': controller.isInfiniteMode }]"
      class="table"
    >
      <TableHeader :ref="el => controller.setViewRef('TableHeader', el)" />
      <TableBody :ref="el => controller.setViewRef('TableBody', el)" />
    </table>
    <div
      v-if="controller.queryLoadingVisible && !controller.isInfiniteMode"
      class="infinite-loading-overlay"
      role="status"
      aria-live="polite"
    >
      <Loader
        :loading="true"
        :text="$t('common.loading')"
      />
    </div>
  </div>
  <!-- Classic CARE spinner over the skeleton: overlay is outside the scrolled content
       so it does not change scroll height or row-index maths. -->
  <div
    v-if="controller.isInfiniteMode && controller.infiniteFetching"
    class="infinite-loading-overlay"
    role="status"
    aria-live="polite"
  >
    <Loader
      :loading="true"
      :text="$t('common.loading')"
    />
  </div>
  </div>
  <InfiniteScrollbar :ref="el => controller.setViewRef('InfiniteScrollbar', el)" />
  </div></template>
<script>
import TableHeader from "./TableHeader.vue";
import TableBody from "./TableBody.vue";
import InfiniteScrollbar from "./InfiniteScrollbar.vue";
import Loader from "@/basic/Loading.vue";

export default {
name:"BackendScrollShell",
components: {TableHeader,TableBody,InfiniteScrollbar,Loader},
inject: { controller: { from: "backendTableController" } },
methods: {
enterInfiniteMode() {
      this.controller.infiniteScrollbarVisible = false;
      this.controller.rowsBefore = 0;
      this.controller.virtualStart = 0;
      this.controller.virtualEnd = this.controller.queryItems.length;
      this.controller.visibleFirstRow = 0;
      this.controller.visibleLastRow = 0;
      this.controller.windowStartCursorValid = true;
      this.controller.windowEndCursorValid = true;
      this.controller.emptyBlockKey = null;
      this.controller.pendingInserts = 0;
      this.controller.pendingStructural = false;
      this.controller.$nextTick(() => {
        this.controller.attachInfiniteScroll();
        this.controller.measureRowHeight();
        this.controller.updateVirtualWindow();
        requestAnimationFrame(() => {
          this.controller.measureRowHeight();
          this.controller.updateVirtualWindow();
        });
      });
    },
exitInfiniteMode() {
      this.controller.detachInfiniteScroll();
      this.controller.infiniteScrollbarVisible = false;
      clearTimeout(this.controller.seekTimer);
      clearTimeout(this.controller.windowRefetchTimer);
      this.controller.seekTimer = null;
      this.controller.windowRefetchTimer = null;
      this.controller.windowRefetchHighlight = [];
      this.controller.rowsBefore = 0;
      this.controller.virtualStart = 0;
      this.controller.virtualEnd = 0;
      this.controller.visibleFirstRow = 0;
      this.controller.visibleLastRow = 0;
    },
infiniteScrollTarget() {
      const wrapper = this.controller.tableRefs.tableWrapper;
      if (wrapper && (this.controller.isInfiniteMode || this.controller.maxTableHeight)) return wrapper;
      return null;
    },
attachInfiniteScroll() {
      this.controller.detachInfiniteScroll();
      this.controller.scrollTarget = this.controller.infiniteScrollTarget();
      this.controller.scrollHandler = () => {
        if (this.controller.suppressScroll) {
          this.controller.suppressScroll = false;
          return;
        }
        this.controller.pinnedRow = null;
        this.controller.thumbFraction = null;
        this.controller.scheduleVirtualUpdate();
      };
      (this.controller.scrollTarget || window).addEventListener("scroll", this.controller.scrollHandler, {passive: true});
      window.addEventListener("resize", this.controller.scrollHandler, {passive: true});
      // First layout often has clientHeight 0 / a few rows; wait for the scroll area to settle.
      if (typeof ResizeObserver !== "undefined" && this.controller.tableRefs.tableWrapper) {
        this.controller.infiniteResizeObserver = new ResizeObserver(() => this.controller.scheduleVirtualUpdate());
        this.controller.infiniteResizeObserver.observe(this.controller.tableRefs.tableWrapper);
      }
    },
detachInfiniteScroll() {
      this.controller.stopInfiniteThumbDrag();
      if (this.controller.infiniteResizeObserver) {
        this.controller.infiniteResizeObserver.disconnect();
        this.controller.infiniteResizeObserver = null;
      }
      if (this.controller.scrollHandler) {
        (this.controller.scrollTarget || window).removeEventListener("scroll", this.controller.scrollHandler);
        window.removeEventListener("resize", this.controller.scrollHandler);
      }
      if (this.controller.scrollRaf) {
        cancelAnimationFrame(this.controller.scrollRaf);
        this.controller.scrollRaf = null;
      }
      this.controller.scrollHandler = null;
      this.controller.scrollTarget = null;
    },
maintainInfiniteWindow() {
      if (!this.controller.isInfiniteMode || this.controller.queryLoading || this.controller.windowFetchBusy) return;
      // A load just failed: without this pause the same rows are requested again on the next
      // frame. The next scroll after the pause tries again.
      if (Date.now() < this.controller.windowRetryAt) return;
      // Thumb jump owns the viewport until its rows are on screen. A resize in that
      // gap used to queue a second and third load.
      if (this.controller.pinnedRow != null || this.controller.windowHold || this.controller.seekTimer) return;
      if (this.controller.loadedCount === 0) {
        // Window ran dry (e.g. everything on it was deleted) but the result set is not empty.
        if (this.controller.total > 0) {
          this.controller.scheduleWindowSeek(Math.min(this.controller.visibleFirstRow, this.controller.total - 1));
        }
        return;
      }
      const windowStart = this.controller.rowsBefore;
      const windowEnd = this.controller.rowsBefore + this.controller.loadedCount;
      const anchor = this.controller.pinnedRow != null ? this.controller.pinnedRow : this.controller.visibleFirstRow;

      if (anchor < windowStart - this.controller.infinitePrefetchRows
        || anchor > windowEnd + this.controller.infinitePrefetchRows) {
        // Scrollbar was dragged past everything we hold — re-anchor by row index.
        this.controller.scheduleWindowSeek(anchor);
        return;
      }
      if (this.controller.rowsAfter > 0 && windowEnd - this.controller.visibleLastRow <= this.controller.infinitePrefetchRows) {
        this.controller.fetchWindowBlock("after");
        return;
      }
      if (this.controller.rowsBefore > 0 && this.controller.visibleFirstRow - windowStart <= this.controller.infinitePrefetchRows) {
        this.controller.fetchWindowBlock("before");
      }
    },
handleInfiniteDelta(delta) {
      const {operation, row} = delta;
      const loadedIndex = this.controller.queryItems.findIndex((item) => item.id === row.id);
      const loaded = loadedIndex >= 0;
      // The result set moved, so an edge that had nothing to give may have rows now.
      this.controller.emptyBlockKey = null;

      if (operation === "delete") {
        if (this.controller.processedDeleteIds.has(row.id)) return;
        this.controller.processedDeleteIds.add(row.id);
        if (this.controller.deletingIds.has(row.id) || this.controller.isPlaceholderRow(row.id)) return;
        // Same as page mode: a delete outside this filter or search is not part of the total.
        if (!loaded && !this.controller.passesCurrentFilter(row)) return;
        this.controller.bumpTotal(-1);
        if (loaded) {
          if (this.controller.isRowIndexVisible(loadedIndex)) {
            this.controller.markRowDeleted(row.id);
          } else {
            this.controller.removeWindowRow(row.id, loadedIndex);
          }
          return;
        }
        if (this.controller.rowsBefore > 0 && this.controller.isBeforeAnchor(row)) {
          this.controller.rowsBefore -= 1;
          this.controller.shiftScrollForRows(-1);
        }
        return;
      }

      if (operation === "update") {
        if (this.controller.deletingIds.has(row.id) || this.controller.isPlaceholderRow(row.id)) return;
        if (!this.controller.passesCurrentFilter(row)) {
          // Dropped out of the query (filter, search, rights): treat like a delete.
          if (loaded) {
            this.controller.bumpTotal(-1);
            if (this.controller.isRowIndexVisible(loadedIndex)) {
              this.controller.markRowDeleted(row.id);
            } else {
              this.controller.removeWindowRow(row.id, loadedIndex);
            }
          }
          return;
        }
        const oldRow = loaded ? this.controller.queryItems[loadedIndex] : null;
        const sortColumn = this.controller.currentQuery?.sort?.column;
        const sortKeyChanged = !!(oldRow && sortColumn && oldRow[sortColumn] !== row[sortColumn]);
        const structural = sortKeyChanged || this.controller.updateTouchesActiveFilters(oldRow, row);
        if (loaded && !structural) {
          this.controller.replaceRow(row);
          return;
        }
        if (loaded || this.controller.rowBelongsInWindow(row)) {
          // The row moved within the order — let the server place it and highlight it after.
          this.controller.scheduleWindowRefetch(row.id);
        }
        return;
      }

      if (operation === "create") {
        if (this.controller.deletingIds.has(row.id)) return;
        if (!this.controller.passesCurrentFilter(row) || loaded) return;
        this.controller.bumpTotal(1);
        if (this.controller.isAfterCurrentPage(row)) {
          // Below the window: only the bottom spacer grows.
          return;
        }
        if (this.controller.isBeforeAnchor(row)) {
          // Above the window: the top spacer grows, so hold the viewport in place.
          this.controller.rowsBefore += 1;
          this.controller.shiftScrollForRows(1);
          return;
        }
        this.controller.insertWindowRow(row);
      }
    }
}
};
</script>
<style scoped>

:deep(.table-manage-col) {
  white-space: nowrap;
  box-sizing: border-box;
}
:deep(.manage-col-sizer) {
  height: 0;
  overflow: hidden;
  visibility: hidden;
  pointer-events: none;
  white-space: nowrap;
}
.table-infinite-shell {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  margin-bottom: 1rem;
  min-height: 0;
}
.table-infinite-main {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}
.table-wrapper.table-infinite {
  margin-bottom: 0;
  overflow-x: auto;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.table-wrapper.table-infinite::-webkit-scrollbar {
  width: 0;
  height: 0;
}
.infinite-loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.45);
  pointer-events: none;
}
:deep(.table-virtual.table-striped > tbody > tr > *) {
  --bs-table-color-type: initial;
  --bs-table-bg-type: initial;
}
:deep(.table-virtual.table-striped > tbody > tr.row-stripe-odd > *) {
  --bs-table-color-type: var(--bs-table-striped-color);
  --bs-table-bg-type: var(--bs-table-striped-bg);
}

</style>
<style scoped src="../table.css"></style>
