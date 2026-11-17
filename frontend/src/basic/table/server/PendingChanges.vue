<template>
<Transition name="pending-banner">
    <div
      v-if="pendingBannerVisible"
      class="pending-inserts-banner"
      role="button"
      :aria-busy="controller.pendingLoadPhase === 'out'"
      @click="controller.loadPendingChanges"
    >
      {{ pendingBannerText }}
    </div>
  </Transition>
</template>
<script>

import { resolveApiMessage } from "@/assets/utils";
export default {
name:"BackendPendingChanges",
inject: { controller: { from: "backendTableController" } },
computed: {
pendingBannerVisible() {
      // Infinite scroll absorbs inserts with the spacers, so it never needs the banner.
      return !this.controller.isInfiniteMode && (this.controller.pendingInserts > 0 || this.controller.pendingStructural);
    },
pendingBannerText() {
      if (this.controller.pendingInserts > 0) {
        const key = this.controller.pendingInserts === 1 ? "common.pendingInsertOne" : "common.pendingInsertMany";
        return this.$t(key, { count: this.controller.pendingInserts });
      }
      return this.$t("common.tableUpdatedRefresh");
    }
},
methods: {
offsetNavForPage(page) {
      const target = Math.max(1, Number(page) || 1);
      if (target === 1) return {};
      return {offset: (target - 1) * this.controller.limit};
    },
async loadPendingChanges() {
      if (this.controller.pendingLoadBusy) return;
      if (!this.controller.currentQuery) {
        this.controller.fetchQueryPage();
        return;
      }

      const previousIds = new Set(this.controller.queryItems.map((i) => i.id));
      const page = this.controller.currentPage;

      this.controller.pendingLoadBusy = true;
      this.controller.pendingInserts = 0;
      this.controller.pendingStructural = false;
      this.controller.pendingLoadPhase = "out";

      const reduceMotion =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      const outMs = reduceMotion ? 0 : 180;
      const startedAt = Date.now();

      const finishIn = () => {
        this.controller.pendingLoadPhase = "in";
        this.controller.$nextTick(() => {
          requestAnimationFrame(() => {
            this.controller.pendingLoadPhase = null;
          });
        });
        clearTimeout(this.controller.enteringClearTimer);
        this.controller.enteringClearTimer = setTimeout(() => {
          this.controller.enteringIds = [];
          this.controller.enteringBottomIds = [];
          this.controller.pendingLoadBusy = false;
        }, reduceMotion ? 0 : 1200);
      };

      const scheduleFinishIn = () => {
        const wait = Math.max(0, outMs - (Date.now() - startedAt));
        if (wait > 0) {
          setTimeout(finishIn, wait);
        } else {
          finishIn();
        }
      };
      const resetBanner = () => {
        this.controller.pendingLoadPhase = null;
        this.controller.pendingLoadBusy = false;
      };
      const callbacks = {
        highlightNewFrom: previousIds,
        onError: resetBanner,
        // A newer fetch (search, sort, page size, ...) replaced this one; its result owns the
        // page now, so only drop the banner's dimmed/busy state.
        onIgnored: resetBanner,
      };

      // Reload this page number by position. The stored `after` still points at the
      // old window, so a row inserted before it would never appear there.
      // Rows that were not on the page get the enter animation.
      const nav = this.controller.isInfiniteMode
        ? (page > 1 ? this.controller.currentNav() : {})
        : this.controller.offsetNavForPage(page);
      this.controller.fetchQueryPage({
        ...callbacks,
        nav,
        onApplied: (data) => {
          const total = data?.meta?.total || 0;
          const shrunkPastPage = !this.controller.isInfiniteMode && nav.offset > 0
            && !(data?.items?.length) && total > 0;
          if (!shrunkPastPage) {
            scheduleFinishIn();
            return;
          }
          // Rows were removed and this page no longer exists: show the new last page.
          const pageSize = this.controller.limit;
          const remainder = pageSize > 0 ? total % pageSize : 0;
          this.controller.currentPage = Math.max(1, Math.ceil(total / pageSize));
          this.controller.fetchQueryPage({
            ...callbacks,
            nav: {fromEnd: true, limit: remainder || pageSize},
            onApplied: scheduleFinishIn,
          });
        },
      });
    },
buildQueryPayload(nav = {}) {
      // Sort, search and column filters ride along on every request — block fetches of the
      // infinite window included, otherwise the window would stitch two result sets together.
      const limit = nav.limit > 0 ? nav.limit : this.controller.limit;
      const sort = this.controller.sortColumn
        ? {column: this.controller.sortColumn, direction: this.controller.sortDirection}
        : {column: "id", direction: "ASC"};
      const query = {limit, sort};
      const search = (this.controller.search || "").trim();
      if (search) query.search = search;
      if (Object.keys(this.controller.activeColumnFilters).length > 0) {
        query.columnFilters = this.controller.activeColumnFilters;
      }
      if (this.controller.querySearchColumns && this.controller.querySearchColumns.length > 0) {
        query.searchColumns = this.controller.querySearchColumns;
      }
      // Keyset navigation: absence of all three → first page.
      if (nav.after) query.after = nav.after;
      if (nav.before) query.before = nav.before;
      if (nav.fromEnd) query.fromEnd = true;
      // Absolute position: infinite window (jump / refetch in place) and reloading page N
      // after pending changes. Ignored by the backend when a cursor is sent.
      if (nav.offset > 0) query.offset = nav.offset;
      const payload = {
        table: this.controller.table,
        filter: this.controller.queryFilter || [],
        query,
      };
      if (this.controller.hasQueryScope) {
        // Copy: the socket must not mutate the reactive scope and retrigger its watcher.
        payload.scope = JSON.parse(JSON.stringify(this.controller.queryScope));
      }
      return payload;
    },
releaseSupersededWindow() {
      this.controller.windowFetchBusy = false;
      this.controller.windowHold = false;
      this.controller.pinnedRow = null;
    },
applyEnrich(row) {
      if (typeof this.controller.enrichRow !== "function") {
        return {...row};
      }
      try {
        return this.controller.enrichRow({...row});
      } catch (err) {
        console.warn("BackendTable enrichRow failed", err);
        return {...row};
      }
    },
fetchQueryPage(options = {}) {
      if (!this.controller.$socket) return;
      if (!this.controller.$socket.connected) {
        // Socket uses autoConnect:false; emit+ack before connect is dropped.
        if (!this.controller.pendingConnectFetch) {
          this.controller.pendingConnectFetch = () => {
            this.controller.pendingConnectFetch = null;
            this.controller.fetchQueryPage(options);
          };
          this.controller.$socket.once("connect", this.controller.pendingConnectFetch);
        }
        return;
      }
      const nav = options.nav || {};
      this.controller.queryLoading = true;
      const token = ++this.controller.queryToken;
      if (this.controller.isInfiniteMode) {
        // Window blocks use seekToken, not queryToken. Bump it so an in-flight
        // fetchWindowBlock / seek / refetch cannot append into this new result.
        this.controller.seekToken += 1;
        clearTimeout(this.controller.seekTimer);
        this.controller.seekTimer = null;
      }
      const payload = this.controller.buildQueryPayload(nav);
      // timeout() makes the ack (err, response). A lost ack or a disconnect
      // ends the wait, so pagination is not stuck on queryLoading.
      this.controller.$socket.timeout(15000).emit("queryTable", payload, (err, response) => {
        if (token !== this.controller.queryToken) {
          if (typeof options.onIgnored === "function") options.onIgnored();
          return;
        }
        this.controller.queryLoading = false;
        if (err || !response?.success) {
          if (Number.isInteger(options.pageOnFailure)) {
            this.controller.currentPage = options.pageOnFailure;
          }
          if (this.controller.isInfiniteMode) this.controller.releaseSupersededWindow();
          this.controller.eventBus.emit("toast", {
            message: resolveApiMessage(response),
            variant: "danger",
          });
          if (typeof options.onError === "function") options.onError(err || response);
          return;
        }
        try {
          this.controller.applyQueryResult(response.data, {
            highlightNewFrom: options.highlightNewFrom || null,
            requestedNav: nav,
          });
          if (typeof options.onApplied === "function") {
            options.onApplied(response.data);
          }
        } catch (applyErr) {
          if (Number.isInteger(options.pageOnFailure)) {
            this.controller.currentPage = options.pageOnFailure;
          }
          if (this.controller.isInfiniteMode) this.controller.releaseSupersededWindow();
          console.warn("queryTable applyQueryResult failed", applyErr);
          if (typeof options.onError === "function") options.onError(applyErr);
        }
      });
    },
fetchQueryPageAsync(options = {}) {
      return new Promise((resolve, reject) => {
        this.controller.fetchQueryPage({
          ...options,
          onApplied: (data) => {
            if (typeof options.onApplied === "function") options.onApplied(data);
            resolve(data);
          },
          onError: (err) => {
            if (typeof options.onError === "function") options.onError(err);
            reject(err);
          },
          onIgnored: () => reject(Object.assign(new Error("query superseded"), {superseded: true})),
        });
      });
    },
currentNav() {
      const q = this.controller.currentQuery || {};
      return {
        after: q.after || undefined,
        before: q.before || undefined,
        fromEnd: q.fromEnd || undefined,
        offset: q.offset > 0 ? q.offset : undefined,
        limit: q.fromEnd ? q.limit : undefined,
      };
    }
}
};
</script>

<style scoped>
.pending-inserts-banner {
  cursor: pointer;
  margin-bottom: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.25rem;
  background: rgba(13, 110, 253, 0.12);
  color: #084298;
  font-size: 0.875rem;
  text-align: center;
  overflow: hidden;
}
.pending-inserts-banner:hover {
  background: rgba(13, 110, 253, 0.2);
}
.pending-banner-enter-active,
.pending-banner-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease,
    max-height 0.22s ease,
    margin 0.22s ease,
    padding 0.22s ease;
}
.pending-banner-enter-from,
.pending-banner-leave-to {
  opacity: 0;
  transform: translateY(-6px);
  max-height: 0;
  margin-bottom: 0;
  padding-top: 0;
  padding-bottom: 0;
}
.pending-banner-enter-to,
.pending-banner-leave-from {
  max-height: 3rem;
}
@media (prefers-reduced-motion: reduce) {
  .pending-banner-enter-active,
  .pending-banner-leave-active {
    transition: none;
  }
}
</style>
