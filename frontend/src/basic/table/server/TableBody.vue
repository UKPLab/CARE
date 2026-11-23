<template>
<tbody :ref="el => controller.setViewRef('tableBody', el)">
        <tr v-if="controller.isInfiniteMode && controller.topSpacerHeight > 0">
          <td
            :colspan="controller.emptyColspan"
            class="virtual-spacer-fill"
            :style="{ height: controller.topSpacerHeight + 'px' }"
          ></td>
        </tr>
        <tr v-if="!controller.showPlaceholderRows && controller.total > 0 && controller.queryItems.length === 0">
          <td
            :colspan="controller.emptyColspan"
            class="text-center"
          >
            {{ $t('common.loadingFromServer') }}
          </td>
        </tr>
        <tr v-else-if="!controller.showPlaceholderRows && controller.queryItems.length === 0">
          <td
            :colspan="controller.emptyColspan"
            class="text-center"
          >
            {{ $t('common.noData') }}
          </td>
        </tr>
        <TableRow v-for="(r, rowIndex) in controller.tableData" v-else :key="r.__sid || r.id" :row="r" :row-index="rowIndex" />
        <tr v-if="controller.isInfiniteMode && controller.bottomSpacerHeight > 0">
          <td
            :colspan="controller.emptyColspan"
            class="virtual-spacer-fill"
            :style="{ height: controller.bottomSpacerHeight + 'px' }"
          ></td>
        </tr>
      </tbody>
</template>
<script>
import TableRow from "./TableRow.vue";

export default {
name:"BackendTableBody",
components: { TableRow },
inject: { controller: { from: "backendTableController" } },
methods: {

}
};
</script>

<style scoped>
.virtual-spacer-fill {
  padding: 0;
  border: 0;
  pointer-events: none;
}
/* This tbody is the root here; .table-wrapper (ScrollShell) carries the reload phase. */
.table-wrapper tbody {
  transition: opacity 0.22s ease, filter 0.22s ease;
}
/* Banner reload: the rows fade out, then in again. */
.table-wrapper.pending-load-out tbody {
  opacity: 0.28;
  filter: saturate(0.7);
}
.table-wrapper.pending-load-in tbody {
  opacity: 1;
  filter: none;
}
@media (prefers-reduced-motion: reduce) {
  .table-wrapper tbody {
    transition: none;
  }
}
/* Row states; the rows themselves are TableRow roots, so reach them below this tbody. */
:deep(.row-deleting td) {
  position: relative;
  z-index: 0;
  animation: row-delete-flash 0.75s ease forwards;
}
@keyframes row-delete-flash {
  0% {
    background-color: rgba(220, 53, 69, 0.55);
    box-shadow: inset 3px 0 0 #dc3545;
    opacity: 1;
  }
  45% {
    background-color: rgba(220, 53, 69, 0.32);
    box-shadow: inset 3px 0 0 #dc3545;
    opacity: 1;
  }
  100% {
    background-color: rgba(220, 53, 69, 0.08);
    box-shadow: inset 3px 0 0 transparent;
    opacity: 0;
  }
}
:deep(.row-placeholder) {
  pointer-events: none;
}
:deep(.row-placeholder td) {
  opacity: 1 !important;
  color: transparent !important;
  border-color: #e9ecef !important;
  background: linear-gradient(
    90deg,
    #eceff1 0%,
    #f5f7f8 40%,
    #eceff1 80%
  ) !important;
  background-size: 200% 100% !important;
  animation: skeleton-shimmer 1.1s ease-in-out infinite !important;
  box-shadow: none !important;
}
:deep(.row-placeholder td *) {
  visibility: hidden;
}
@keyframes skeleton-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}
:deep(.row-updated td) {
  position: relative;
  z-index: 0;
  animation: row-update-flash 1.4s ease;
}
@keyframes row-update-flash {
  0% {
    background-color: rgba(25, 135, 84, 0.5);
    box-shadow: inset 3px 0 0 #198754;
  }
  45% {
    background-color: rgba(25, 135, 84, 0.28);
    box-shadow: inset 3px 0 0 #198754;
  }
  100% {
    background-color: transparent;
    box-shadow: inset 0 0 0 transparent;
  }
}
:deep(.row-entering td),
:deep(.row-entering-bottom td) {
  position: relative;
  z-index: 0;
}
:deep(.row-entering td) {
  animation: row-enter-flash 1.15s ease;
}
:deep(.row-entering-bottom td) {
  animation: row-enter-from-bottom 0.95s ease;
}
@keyframes row-enter-flash {
  0% {
    background-color: rgba(13, 110, 253, 0.42);
    box-shadow: inset 3px 0 0 #0d6efd;
  }
  45% {
    background-color: rgba(25, 135, 84, 0.22);
    box-shadow: inset 3px 0 0 #198754;
  }
  100% {
    background-color: transparent;
    box-shadow: inset 0 0 0 transparent;
  }
}
@keyframes row-enter-from-bottom {
  0% {
    background-color: rgba(13, 110, 253, 0.4);
    box-shadow: inset 0 -3px 0 #0d6efd;
    opacity: 0.15;
  }
  40% {
    background-color: rgba(25, 135, 84, 0.22);
    box-shadow: inset 0 -3px 0 #198754;
    opacity: 1;
  }
  100% {
    background-color: transparent;
    box-shadow: inset 0 0 0 transparent;
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  :deep(.row-entering td),
  :deep(.row-entering-bottom td) {
    animation: none;
    background-color: rgba(25, 135, 84, 0.18);
  }

  :deep(.row-updated td) {
    animation: none;
    background-color: rgba(25, 135, 84, 0.22);
  }

  :deep(.row-deleting td) {
    animation: none;
    background-color: rgba(220, 53, 69, 0.35);
    opacity: 0.4;
  }

  :deep(.row-placeholder td) {
    animation: none !important;
    background: #eceff1 !important;
  }
}
</style>

<style scoped src="../table.css"></style>
