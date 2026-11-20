
/**
 * "All" mode progressive-rendering subsystem for Table.vue (BasicTable).
 *
 * When itemsPerPage is set to 0 ("All"), renders a growing prefix of the
 * filtered/sorted data instead of the full set at once, appending the
 * next chunk when a sentinel row scrolls into view. Kept separate from
 * tableFixedColumns.js: both are independent DOM-measurement
 * subsystems, but neither depends on the other.
 *
 * Exports a data factory and methods for spread composition into
 * Table.vue.
 *
 * @author Dennis Zyska, Nils Dycke, Linyin Huang
 */

// Fresh data factory so observer/render-limit state is never shared across table instances
export function tableProgressiveRenderingData() {
  return {
    allRenderLimit: 75, // Render only the first 75 items when "All" is selected to avoid UI freeze
    allChunkSize: 50, // Append the next 50 items on scroll
    allObserver: null,
  };
}

export const tableProgressiveRenderingMethods = {
  setupAllObserver() {
    this.cleanupAllObserver();

    const wrapper = this.$refs.tableWrapper;
    const sentinel = this.$refs.loadMoreSentinel;
    if (!sentinel) return;

    // If there is a scroll container (maxTableHeight), observe within it.
    // Otherwise observe in the viewport.
    const root = wrapper && this.maxTableHeight ? wrapper : null;

    this.allObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;

        if (this.allRenderLimit < this.total) {
          this.allRenderLimit = Math.min(this.total, this.allRenderLimit + this.allChunkSize);
        }
      },
      {
        root,
        threshold: 0.1,
      }
    );

    this.allObserver.observe(sentinel);
  },

  cleanupAllObserver() {
    if (this.allObserver) {
      this.allObserver.disconnect();
      this.allObserver = null;
    }
  },
};

export const backendtableProgressiveRenderingMethods = {
applyWindowMeta(meta, {start = false, end = false} = {}) {
      if (!meta) return;
      if (Number.isFinite(meta.total)) {
        this.queryMeta.total = meta.total;
        this.queryMeta.totalPages = 1;
      }
      if (start && meta.startCursor) this.queryMeta.startCursor = meta.startCursor;
      if (end && meta.endCursor) this.queryMeta.endCursor = meta.endCursor;
      this.queryMeta.hasPrev = this.rowsBefore > 0;
      this.queryMeta.hasNext = this.rowsAfter > 0;
    },
syncWindowQuery() {
      this.currentQuery = {
        limit: this.loadedCount || this.infiniteBlockSize,
        sort: {
          column: this.sortColumn || "id",
          direction: this.sortDirection || "ASC",
        },
        after: null,
        before: null,
        fromEnd: false,
        offset: this.rowsBefore,
        search: (this.search || "").trim() || null,
        columnFilters: this.activeColumnFilters,
      };
    },
async fetchWindowBlock(direction) {
      if (!this.isInfiniteMode || this.windowFetchBusy || !this.$socket?.connected) return;
      let nav;
      if (direction === "after") {
        nav = (this.windowEndCursorValid && this.queryMeta.endCursor)
          ? {after: this.queryMeta.endCursor}
          : {offset: this.rowsBefore + this.loadedCount, limit: this.infiniteBlockSize};
      } else {
        const wanted = Math.min(this.infiniteBlockSize, this.rowsBefore);
        if (wanted <= 0) return;
        nav = (this.windowStartCursorValid && this.queryMeta.startCursor)
          ? {before: this.queryMeta.startCursor}
          : {offset: Math.max(0, this.rowsBefore - wanted), limit: wanted};
      }
      // A block that brings nothing new must not be requested again on the next scroll frame.
      const navKey = `${direction}:${nav.after || nav.before || `offset-${nav.offset}`}`;
      if (this.emptyBlockKey === navKey) return;
      const token = ++this.seekToken;
      this.windowFetchBusy = true;
      try {
        const {items, meta} = await this.requestQueryItems(this.buildQueryPayload(nav));
        if (!this.isInfiniteMode || token !== this.seekToken) return;
        const added = direction === "after"
          ? this.appendWindowBlock(items, meta)
          : this.prependWindowBlock(items, meta);
        this.emptyBlockKey = added > 0 ? null : navKey;
        this.clearWindowLoadError();
      } catch (err) {
        if (token === this.seekToken) {
          this.handleWindowLoadError(err);
        }
      } finally {
        if (token === this.seekToken) {
          this.windowFetchBusy = false;
          this.$nextTick(() => {
            this.measureRowHeight();
            this.scheduleVirtualUpdate();
          });
        }
      }
    },
appendWindowBlock(items, meta) {
      const known = new Set(this.queryItems.map((row) => row.id));
      const fresh = items.filter((row) => row?.id != null && !known.has(row.id));
      if (fresh.length) {
        let next = [...this.queryItems, ...fresh];
        const overflow = next.length - this.infiniteMaxRows;
        if (overflow > 0) {
          // Give back the rows furthest above: rowsBefore absorbs them, so nothing shifts.
          next = next.slice(overflow);
          this.rowsBefore += overflow;
          this.windowStartCursorValid = false;
        }
        this.queryItems = next;
        this.windowEndCursorValid = true;
      }
      this.applyWindowMeta(meta, {end: fresh.length > 0});
      this.syncWindowQuery();
      return fresh.length;
    },
prependWindowBlock(items, meta) {
      const known = new Set(this.queryItems.map((row) => row.id));
      const fresh = items.filter((row) => row?.id != null && !known.has(row.id));
      if (fresh.length) {
        let next = [...fresh, ...this.queryItems];
        this.rowsBefore = Math.max(0, this.rowsBefore - fresh.length);
        const overflow = next.length - this.infiniteMaxRows;
        if (overflow > 0) {
          next = next.slice(0, next.length - overflow);
          this.windowEndCursorValid = false;
        }
        this.queryItems = next;
        this.windowStartCursorValid = true;
      } else if (meta && meta.hasPrev === false && this.rowsBefore > 0) {
        // Nothing above after all: rowsBefore drifted (concurrent writes). Collapse the top
        // spacer and hold the viewport, which lands at the real start of the result.
        const drift = this.rowsBefore;
        this.rowsBefore = 0;
        this.shiftScrollForRows(-drift);
      }
      this.applyWindowMeta(meta, {start: fresh.length > 0});
      this.syncWindowQuery();
      return fresh.length;
    },
replaceWindow(items, meta, offset, {clearEntering = false} = {}) {
      this.queryItems = items;
      this.virtualStart = 0;
      this.virtualEnd = items.length;
      this.rowsBefore = (meta && Number.isFinite(meta.offset)) ? meta.offset : offset;
      this.windowStartCursorValid = true;
      this.windowEndCursorValid = true;
      this.emptyBlockKey = null;
      this.clearWindowLoadError();
      this.applyWindowMeta(meta, {start: true, end: true});
      this.deletingIds = new Set();
      this.placeholderIds = new Set();
      if (clearEntering) {
        this.enteringIds = [];
        this.enteringBottomIds = [];
      }
      this.syncWindowQuery();
    },
scheduleWindowSeek(targetRow) {
      clearTimeout(this.seekTimer);
      this.seekTimer = setTimeout(() => {
        this.seekTimer = null;
        this.seekWindow(targetRow);
      }, 120);
    },
async seekWindow(targetRow) {
      if (!this.isInfiniteMode || this.windowFetchBusy || !this.$socket?.connected) {
        if (!this.windowFetchBusy) this.windowHold = false;
        return;
      }
      // Sit the target in the middle of the window. A short pad left it inside the
      // prefetch margin, so one click immediately fetched the block above and below.
      const wanted = this.infiniteMaxRows;
      const highest = Math.max(0, this.total - wanted);
      const offset = Math.max(0, Math.min(targetRow - Math.floor(wanted / 2), highest));
      const token = ++this.seekToken;
      this.windowHold = true;
      this.windowFetchBusy = true;
      try {
        const {items, meta} = await this.requestQueryItems(
          this.buildQueryPayload({offset, limit: wanted})
        );
        if (!this.isInfiniteMode || token !== this.seekToken) {
          if (token === this.seekToken) {
            this.windowHold = false;
            this.pinnedRow = null;
          }
          return;
        }
        this.replaceWindow(items, meta, offset, {clearEntering: true});
        const loadedLast = this.rowsBefore + Math.max(0, items.length - 1);
        const show = Math.min(targetRow, loadedLast);
        const local = Math.max(0, show - this.rowsBefore);
        this.virtualStart = local;
        this.virtualEnd = items.length;
        // Spacers stay collapsed while pinned, so these rows sit in the viewport at once.
        this.$nextTick(() => {
          this.pinnedRow = null;
          this.$nextTick(() => {
            this.scrollToRowIndex(show);
            this.updateVirtualWindow();
            this.windowHold = false;
          });
        });
      } catch (err) {
        if (token === this.seekToken) {
          this.handleWindowLoadError(err);
          this.windowHold = false;
          this.pinnedRow = null;
        }
      } finally {
        if (token === this.seekToken) {
          this.windowFetchBusy = false;
        }
      }
    },
scheduleWindowRefetch(highlightId = null) {
      if (!this.isInfiniteMode) return;
      if (highlightId != null && !this.windowRefetchHighlight.includes(highlightId)) {
        this.windowRefetchHighlight.push(highlightId);
      }
      clearTimeout(this.windowRefetchTimer);
      this.windowRefetchTimer = setTimeout(() => {
        this.windowRefetchTimer = null;
        this.refetchWindow();
      }, 150);
    },
async refetchWindow() {
      if (!this.isInfiniteMode || !this.$socket?.connected) return;
      if (this.windowFetchBusy) {
        this.scheduleWindowRefetch();
        return;
      }
      const wanted = Math.min(Math.max(this.loadedCount, this.infiniteBlockSize), this.infiniteMaxRows);
      const offset = Math.max(0, Math.min(this.rowsBefore, Math.max(0, this.total - wanted)));
      const anchorId = this.firstVisibleRowId();
      const anchorIndex = anchorId != null
        ? this.rowsBefore + this.queryItems.findIndex((row) => row.id === anchorId)
        : -1;
      const highlight = this.windowRefetchHighlight;
      this.windowRefetchHighlight = [];
      const token = ++this.seekToken;
      this.windowFetchBusy = true;
      try {
        const {items, meta} = await this.requestQueryItems(
          this.buildQueryPayload({offset, limit: wanted})
        );
        if (!this.isInfiniteMode || token !== this.seekToken) return;
        this.replaceWindow(items, meta, offset);

        if (anchorIndex >= 0) {
          const localIndex = items.findIndex((row) => row.id === anchorId);
          if (localIndex >= 0) {
            const drift = (this.rowsBefore + localIndex) - anchorIndex;
            if (drift) this.shiftScrollForRows(drift);
          }
        }
        const stillHere = highlight.filter((id) => items.some((row) => row.id === id));
        if (stillHere.length) {
          this.updatedIds = [...this.updatedIds, ...stillHere];
          setTimeout(() => {
            this.updatedIds = this.updatedIds.filter((id) => !stillHere.includes(id));
          }, 1400);
        }
        this.$nextTick(() => {
          this.measureRowHeight();
          this.updateVirtualWindow();
        });
      } catch (err) {
        if (token === this.seekToken) {
          this.handleWindowLoadError(err);
        }
      } finally {
        if (token === this.seekToken) {
          this.windowFetchBusy = false;
        }
      }
    }
};
