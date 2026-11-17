<template>

  <PendingChanges :ref="el => controller.setViewRef('PendingChanges', el)" />
  <TableSearch
    v-if="controller.options && controller.options['search']"
    :model-value="controller.searchQuery" :schema="controller.queryFilterSchema"
    @update:model-value="controller.setSearchQuery"
  >
    <template #additional-buttons>
      <slot name="additional-buttons"/>
    </template>
  </TableSearch>
  <ScrollShell :ref="el => controller.setViewRef('ScrollShell', el)" />
<PageNavigation :ref="el => controller.setViewRef('PageNavigation', el)" />
</template>
<script>
import ScrollShell from "./ScrollShell.vue";


import PendingChanges from "./PendingChanges.vue";

import PageNavigation from "./PageNavigation.vue";




import TableSearch from "../../table/Search.vue";

import { resolveApiMessage } from "@/assets/utils";
const WINDOW_RETRY_MS = 5000;
export default {
name:"BackendTableSurface",
components: {ScrollShell,PendingChanges,PageNavigation,TableSearch},
inject: { controller: { from: "backendTableController" } },
methods: {
holdQueryMode() {
      if (this.controller.queryHold || !this.controller.$socket) return;
      this.controller.queryHold = true;
      this.controller.onQueryConnect = () => {
        if (!this.controller.queryHold) return;
        this.controller.queryHeldOnSocket = true;
        this.controller.$socket.emit("queryTableAcquire", {table: this.controller.table});
      };
      this.controller.$socket.on("connect", this.controller.onQueryConnect);
      if (this.controller.$socket.connected) {
        this.controller.onQueryConnect();
      }
    },
releaseQueryMode() {
      if (this.controller.onQueryConnect && this.controller.$socket) {
        this.controller.$socket.off("connect", this.controller.onQueryConnect);
      }
      this.controller.onQueryConnect = null;
      if (this.controller.queryHeldOnSocket && this.controller.$socket) {
        this.controller.$socket.emit("queryTableRelease", {table: this.controller.table});
      }
      this.controller.queryHold = false;
      this.controller.queryHeldOnSocket = false;
    },

isOwnSocket(originSocketId) {
      return originSocketId && this.controller.$socket?.id && originSocketId === this.controller.$socket.id;
    },
bumpTotal(delta) {
      this.controller.queryMeta.total = Math.max(0, (this.controller.queryMeta.total || 0) + delta);
      this.controller.queryMeta.totalPages = this.controller.queryMeta.pageSize
        ? Math.ceil(this.controller.queryMeta.total / this.controller.queryMeta.pageSize)
        : 1;
    },
markRowDeleted(id) {
      if (this.controller.isDeletingRow(id) || this.controller.isPlaceholderRow(id)) return;
      const next = new Set(this.controller.deletingIds);
      next.add(id);
      this.controller.deletingIds = next;

      const animMs = this.controller.deleteAnimMs;
      setTimeout(() => {
        // Keep the slot as a frozen skeleton until backfill so layout does not
        // briefly shrink (double-jump). Atomic swap then shifts rows up once.
        const cleared = new Set(this.controller.deletingIds);
        cleared.delete(id);
        this.controller.deletingIds = cleared;
        const placeholders = new Set(this.controller.placeholderIds);
        placeholders.add(id);
        this.controller.placeholderIds = placeholders;
        this.controller.schedulePageBackfill();
      }, animMs);
    },
handleWindowLoadError(err) {
      this.controller.windowRetryAt = Date.now() + WINDOW_RETRY_MS;
      if (this.controller.windowErrorShown) return;
      this.controller.windowErrorShown = true;
      this.controller.eventBus.emit("toast", {
        message: resolveApiMessage(err?.response),
        variant: "danger",
      });
    },
clearWindowLoadError() {
      this.controller.windowRetryAt = 0;
      this.controller.windowErrorShown = false;
    },
replaceRow(updatedRow) {
      const enriched = this.controller.applyEnrich(updatedRow);
      const idx = this.controller.queryItems.findIndex((i) => i.id === enriched.id);
      if (idx === -1) return;
      const prev = this.controller.queryItems[idx];
      const merged = {...prev, ...enriched};
      this.controller.queryItems.splice(idx, 1, merged);
      // Restart highlight even if id was already in the list
      this.controller.updatedIds = this.controller.updatedIds.filter((id) => id !== merged.id);
      this.controller.$nextTick(() => {
        this.controller.updatedIds = [...this.controller.updatedIds, merged.id];
        setTimeout(() => {
          this.controller.updatedIds = this.controller.updatedIds.filter((id) => id !== merged.id);
        }, 1400);
      });
    },
showBannerOrApply(own, applyFn) {
      if (own) {
        applyFn();
      } else {
        this.controller.pendingStructural = true;
      }
    },
updateTouchesActiveFilters(oldRow, newRow) {
      if (!oldRow || !newRow) return false;
      const filters = this.controller.currentQuery?.columnFilters || {};
      for (const [col, filter] of Object.entries(filters)) {
        const active = Array.isArray(filter)
          ? filter.length > 0
          : !!(filter && (filter.operator || filter.value != null && filter.value !== ""));
        if (!active) continue;
        if (oldRow[col] !== newRow[col]) return true;
      }
      return false;
    },
refetchCurrentWindow() {
      if (this.controller.isInfiniteMode) {
        this.controller.scheduleWindowRefetch();
        return;
      }
      this.controller.fetchQueryPage({nav: this.controller.currentNav()});
    },
handleStale(payload = {}) {
      if (this.controller.isInfiniteMode) {
        this.controller.scheduleWindowRefetch();
        return;
      }
      if (this.controller.isOwnSocket(payload.originSocketId)) {
        this.controller.refetchCurrentWindow();
      } else {
        this.controller.pendingStructural = true;
      }
    },
handleDelta(delta) {
      if (!delta) return;
      const {operation, row, originSocketId} = delta;
      if (!row?.id && row?.id !== 0) return;
      if (this.controller.isInfiniteMode) {
        this.controller.handleInfiniteDelta(delta);
        return;
      }
      const own = this.controller.isOwnSocket(originSocketId);
      const currentIds = new Set(this.controller.queryItems.map((i) => i.id));

      if (operation === "delete") {
        if (this.controller.processedDeleteIds.has(row.id)) return;
        this.controller.processedDeleteIds.add(row.id);
        if (this.controller.deletingIds.has(row.id) || this.controller.isPlaceholderRow(row.id)) return;

        // Current page → animate + backfill immediately (no banner). Off-page (before or after
        // the current keyset window): the window is anchored to row cursors, so out-of-window
        // rows leaving don't shift our rows — just adjust the count, no banner.
        const inResult = currentIds.has(row.id) || this.controller.passesCurrentFilter(row);
        if (currentIds.has(row.id)) {
          this.controller.markRowDeleted(row.id);
        }
        if (inResult) this.controller.bumpTotal(-1);
        return;
      }

      if (operation === "update") {
        if (this.controller.deletingIds.has(row.id) || this.controller.isPlaceholderRow(row.id)) return;
        if (!this.controller.passesCurrentFilter(row)) {
          if (currentIds.has(row.id)) {
            // No longer matches current query (filter, search, rights) — remove immediately
            this.controller.markRowDeleted(row.id);
            this.controller.bumpTotal(-1);
          }
          return;
        }
        const sortCol = this.controller.currentQuery?.sort?.column;
        const oldRow = this.controller.queryItems.find((i) => i.id === row.id);
        const sortKeyChanged = !!(oldRow && sortCol && oldRow[sortCol] !== row[sortCol]);
        // Banner only when the updated field is one we actively filter/sort by
        // (sort column or an active columnFilter) — otherwise just highlight.
        const filteredFieldChanged = this.controller.updateTouchesActiveFilters(oldRow, row);
        const structural = sortKeyChanged || filteredFieldChanged;

        if (currentIds.has(row.id)) {
          if (structural) {
            this.controller.showBannerOrApply(own, () => this.controller.fetchQueryPage({nav: this.controller.currentNav()}));
          } else {
            this.controller.replaceRow(row);
          }
          return;
        }

        // Off-page. Unrelated fields (status while the chip is id) must not banner.
        // Only a narrowed query can pull a row into this window; after/before stay silent.
        const queryNarrowed = !!(this.controller.search || Object.keys(this.controller.activeColumnFilters).length);
        if (!queryNarrowed) {
          return;
        }
        if (this.controller.isAfterCurrentPage(row)) {
          return;
        }
        if (own) {
          this.controller.refetchCurrentWindow();
        } else {
          this.controller.pendingInserts += 1;
        }
        return;
      }

      if (operation === "create") {
        if (this.controller.deletingIds.has(row.id)) return;
        if (!this.controller.passesCurrentFilter(row)) return;

        if (this.controller.isAfterCurrentPage(row)) {
          this.controller.bumpTotal(1);
          return;
        }

        if (own) {
          this.controller.refetchCurrentWindow();
          return;
        }

        // This page or before it. After this page: next fetch, no banner.
        this.controller.pendingInserts += 1;
        this.controller.bumpTotal(1);
      }
    }
}
};
</script>



<style scoped src="../table.css"></style>
