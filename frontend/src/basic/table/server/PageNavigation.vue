<template>
<div
    v-if="controller.selectableRows && !(controller.options && controller.options.singleSelect)"
    class="text-end text-muted small mb-2"
  >
    {{ $t('common.selectedCount', { selected: controller.selectedCount, total: controller.totalSelectableCount }) }}
  </div>
  <Pagination
    v-if="controller.options && controller.options.pagination && controller.total > 0"
    :ref="el => controller.setViewRef('pagination', el)"
    :current-page="controller.currentPage"
    :items-per-page="controller.isInfiniteMode ? 0 : controller.limit"
    :items-per-page-list="controller.itemsPerPageList"
    :allow-all="true"
    :show-page-numbers="false"
    :window-first="controller.windowFirstVisible"
    :window-last="controller.windowLastVisible"
    :pages="controller.pages"
    :total-items="controller.total"
    @update-items-per-page="controller.paginationItemsPerPageChange"
    @update-page="controller.paginationPageChange"
  />
</template>
<script>
import Pagination from "../Pagination.vue";
export default {
name:"BackendPageNavigation",
components: { Pagination },
inject: { controller: { from: "backendTableController" } },
methods: {
paginationPageChange(page) {
      if (this.controller.queryLoading) return;
      // Keyset navigation. First / Prev / Next / Last
      const pages = this.controller.pages || 1;
      const target = Math.min(Math.max(1, page), pages);
      const from = this.controller.currentPage;
      if (target === from) return;

      if (target === 1) {
        this.controller.currentPage = 1;
        this.controller.fetchQueryPage({nav: {}, pageOnFailure: from});
      } else if (target === pages) {
        this.controller.currentPage = pages;
        const pageSize = this.controller.limit;
        const remainder = pageSize > 0 ? this.controller.total % pageSize : 0;
        this.controller.fetchQueryPage({nav: {fromEnd: true, limit: remainder || pageSize}, pageOnFailure: from});
      } else if (target === from + 1) {
        this.controller.currentPage = target;
        this.controller.fetchQueryPage({nav: {after: this.controller.queryMeta.endCursor}, pageOnFailure: from});
      } else if (target === from - 1) {
        this.controller.currentPage = target;
        this.controller.fetchQueryPage({nav: {before: this.controller.queryMeta.startCursor}, pageOnFailure: from});
      } else {
        // Reserve, not a path this pager uses. Page numbers are hidden here, so
        // only First, Previous, Next and Last are clickable. Kept in case they
        // return: keyset has no "page N" address, so a jump has to walk cursors.
        this.controller.hopToPage(target);
      }
    },
async hopToPage(target) {
      if (this.controller.hopBusy) return;
      this.controller.hopBusy = true;
      try {
        let guard = 0;
        while (this.controller.currentPage !== target && guard++ < 200) {
          const forward = target > this.controller.currentPage;
          if (forward && !this.controller.queryMeta.hasNext) break;
          if (!forward && !this.controller.queryMeta.hasPrev) break;
          const nav = forward
            ? {after: this.controller.queryMeta.endCursor}
            : {before: this.controller.queryMeta.startCursor};
          const from = this.controller.currentPage;
          this.controller.currentPage += forward ? 1 : -1;
          await this.controller.fetchQueryPageAsync({nav, pageOnFailure: from});
        }
      } catch (err) {
        if (err?.superseded) return;
        console.warn("BackendTable hopToPage failed", err);
      } finally {
        this.controller.hopBusy = false;
      }
    },
paginationUpdate() {
      // Sort / page-size change the keyset: always restart from the first page.
      // Otherwise currentPage stays e.g. 2 while fetchQueryPage() (empty nav) already
      // loaded page 1 — clicking First then only changes the number, not the rows.
      this.controller.currentPage = 1;
      this.controller.fetchQueryPage({nav: {}});
    },
paginationItemsPerPageChange(value) {
      this.controller.itemsPerPage = value;
      this.controller.currentPage = 1;
      this.controller.paginationUpdate();
    },
schedulePageBackfill() {
      clearTimeout(this.controller.backfillTimer);
      this.controller.backfillTimer = setTimeout(() => {
        // A page keeps its row count and backfills; a scroll window just gets shorter.
        if (this.controller.isInfiniteMode) {
          this.controller.finishInfiniteDeletes();
        } else {
          this.controller.backfillAfterDeletes();
        }
      }, 40);
    },
async backfillAfterDeletes() {
      if (this.controller.backfillBusy || !this.controller.$socket?.connected) return;
      if (this.controller.deletingIds && this.controller.deletingIds.size > 0) {
        this.controller.schedulePageBackfill();
        return;
      }

      const pageSize = this.controller.currentQuery?.limit || this.controller.limit;
      const placeholders = this.controller.placeholderIds || new Set();
      const remaining = this.controller.queryItems.filter((row) => !placeholders.has(row.id));
      const need = pageSize - remaining.length;

      if (need <= 0) {
        if (placeholders.size) {
          this.controller.queryItems = remaining;
          this.controller.placeholderIds = new Set();
        }
        return;
      }

      const total = this.controller.queryMeta?.total ?? 0;
      if (total <= remaining.length) {
        this.controller.queryItems = remaining;
        this.controller.placeholderIds = new Set();
        return;
      }

      this.controller.backfillBusy = true;
      // Any fetchQueryPage started while this request is in flight (search, sort, page, ...)
      // bumps queryToken; its result owns the page and also clears placeholderIds.
      const token = this.controller.queryToken;
      try {
        const visibleIds = new Set(remaining.map((i) => i.id));
        // Fill from the *next* page (after current endCursor), not by re-sorting the
        // same keyset window — mid-window replacements would jump in at the top for DESC.
        const endCursor = this.controller.queryMeta?.endCursor;
        const nextPayload = endCursor
          ? this.controller.buildQueryPayload({after: endCursor})
          : this.controller.buildQueryPayload(this.controller.currentNav());
        const {items: nextItems, meta} = await this.controller.requestQueryItems(nextPayload);
        if (token !== this.controller.queryToken) return;
        const bottomFill = nextItems
          .filter((row) => !visibleIds.has(row.id))
          .slice(0, need);

        // Remaining shift up; new rows always append at the bottom (enter-from-bottom).
        this.controller.queryItems = [...remaining, ...bottomFill].slice(0, pageSize);
        if (meta) {
          this.controller.queryMeta.hasNext = meta.hasNext;
          if (meta.hasPrev != null) this.controller.queryMeta.hasPrev = meta.hasPrev;
          if (bottomFill.length && meta.endCursor) {
            this.controller.queryMeta.endCursor = meta.endCursor;
          }
        }
        this.controller.placeholderIds = new Set();
        this.controller.enteringIds = [];
        this.controller.enteringBottomIds = bottomFill.map((row) => row.id);
        clearTimeout(this.controller.enteringClearTimer);
        this.controller.enteringClearTimer = setTimeout(() => {
          this.controller.enteringBottomIds = [];
        }, 1100);
      } catch (err) {
        console.warn("BackendTable backfillAfterDeletes failed", err);
        if (token !== this.controller.queryToken) return;
        this.controller.queryItems = remaining;
        this.controller.placeholderIds = new Set();
      } finally {
        this.controller.backfillBusy = false;
      }
    },
requestQueryItems(payload) {
      return new Promise((resolve, reject) => {
        if (!this.controller.$socket?.connected) {
          reject(new Error("socket not connected"));
          return;
        }
        const t = setTimeout(() => reject(new Error("queryTable timeout")), 15000);
        this.controller.$socket.emit("queryTable", payload, (response) => {
          clearTimeout(t);
          if (!response?.success) {
            const error = new Error(response?.message || "queryTable failed");
            // Keep the reply: its key gives the localized toast text
            error.response = response;
            reject(error);
            return;
          }
          const items = (response.data?.items || []).map((row) => this.controller.applyEnrich(row));
          resolve({items, meta: response.data?.meta || null});
        });
      });
    }
}
};
</script>
