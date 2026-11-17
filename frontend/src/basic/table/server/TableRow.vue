<template>
  <tr
    data-row="1"
    :class="{
      'row-stripe-odd': controller.isInfiniteMode && (controller.infiniteSliceStart + rowIndex) % 2 === 1,
      'row-deleting': controller.isDeletingRow(row.id),
      'row-placeholder': isInactive,
      'row-updated': controller.isUpdatedRow(row.id),
      'row-entering': controller.isEnteringRow(row.id),
      'row-entering-bottom': controller.isEnteringBottomRow(row.id),
    }"
    @click="isInactive ? null : controller.selectRow(row)"
  >
    <td v-if="controller.selectableRows">
      <div
        class="form-check"
        @click.stop=""
      >
        <input
          class="form-check-input pointer"
          type="checkbox"
          :checked="controller.isRowSelected(row)"
          @change="controller.selectRow(row)"
        />
      </div>
    </td>
    <td
      v-for="(c, index) in controller.visibleColumns"
      :key="c.key"
      :class="[
        'width' in c ? 'col-' + c.width : 'col-auto',
        { pointer: controller.selectableRows },
        controller.getFixedColumnClass(c, index),
      ]"
      :style="[controller.getFixedColumnStyle(c), controller.getScrollColumnStyle(c), c.style || {}]"
    >
      <span v-if="c.key in row">
        <!-- Plain text of a scroll column: fixed width, the content scrolls. -->
        <TCell
          :column="c"
          :row="row"
          @action="controller.actionEmitter"
        >
          <template
            v-if="controller.isScrollColumn(c)"
            #text
          >
            <CellScrolling
              :row="row"
              :column="c"
            />
          </template>
        </TCell>
      </span>
      <span v-else> - </span>
    </td>
    <!-- Always rendered once the column exists: a cell that comes and goes with the
         rendered slice would change the table width on every scroll frame. -->
    <td
      v-if="controller.manageColumnActive"
      class="table-manage-col"
      :class="controller.getManageColumnClass()"
      :style="controller.manageColumnLayoutStyle"
      @click.stop=""
    >
      <TButtonGroup
        v-if="!row.__skeleton && buttons.length > 0"
        :buttons="buttons"
        :params="row"
        @action="controller.actionEmitter"
      />
    </td>
  </tr>
</template>

<script>
import TCell from "../Cell.vue";
import TButtonGroup from "../ButtonGroup.vue";
import CellScrolling from "./CellScrolling.vue";

/**
 * One loaded (or skeleton) row of BackendTable: selection checkbox, cells and row buttons.
 * State and actions stay on the BackendTable instance injected as `controller`.
 */
export default {
  name: "BackendTableRow",
  components: { TCell, TButtonGroup, CellScrolling },
  inject: { controller: { from: "backendTableController" } },
  props: {
    row: { type: Object, required: true },
    rowIndex: { type: Number, required: true },
  },
  computed: {
    /** Skeleton or frozen placeholder: not clickable until real data takes its place. */
    isInactive() {
      return !!this.row.__skeleton || this.controller.isPlaceholderRow(this.row.id);
    },
    buttons() {
      return this.controller.rowButtons(this.row);
    },
  },
};
</script>

<style scoped src="../table.css"></style>
<style scoped>
/* Sticky (fixed-column) cells need an opaque flash and must stay above table.css z-index 2. */
.table-wrapper tbody tr.row-deleting td.table-fixed,
.table-wrapper tbody tr.row-deleting td.table-fixed-left,
.table-wrapper tbody tr.row-deleting td.table-fixed-right {
  z-index: 3 !important;
  animation: row-delete-flash-sticky 0.75s ease forwards;
}
@keyframes row-delete-flash-sticky {
  0% {
    background-color: color-mix(in srgb, #dc3545 55%, var(--bs-body-bg, #fff));
    box-shadow: inset 3px 0 0 #dc3545;
    opacity: 1;
  }
  45% {
    background-color: color-mix(in srgb, #dc3545 32%, var(--bs-body-bg, #fff));
    box-shadow: inset 3px 0 0 #dc3545;
    opacity: 1;
  }
  100% {
    background-color: color-mix(in srgb, #dc3545 8%, var(--bs-body-bg, #fff));
    box-shadow: inset 3px 0 0 transparent;
    opacity: 0;
  }
}
.table-wrapper tbody tr.row-placeholder td.table-fixed,
.table-wrapper tbody tr.row-placeholder td.table-fixed-left,
.table-wrapper tbody tr.row-placeholder td.table-fixed-right {
  background: linear-gradient(
    90deg,
    #eceff1 0%,
    #f5f7f8 40%,
    #eceff1 80%
  ) !important;
  background-size: 200% 100% !important;
  animation: skeleton-shimmer 1.1s ease-in-out infinite !important;
}
@keyframes skeleton-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}
.table-wrapper tbody tr.row-updated td.table-fixed,
.table-wrapper tbody tr.row-updated td.table-fixed-left,
.table-wrapper tbody tr.row-updated td.table-fixed-right {
  z-index: 3 !important;
  animation: row-update-flash-sticky 1.4s ease;
}
@keyframes row-update-flash-sticky {
  0% {
    background-color: color-mix(in srgb, #198754 50%, var(--bs-body-bg, #fff));
    box-shadow: inset 3px 0 0 #198754;
  }
  45% {
    background-color: color-mix(in srgb, #198754 28%, var(--bs-body-bg, #fff));
    box-shadow: inset 3px 0 0 #198754;
  }
  100% {
    background-color: var(--bs-body-bg, #fff);
    box-shadow: inset 0 0 0 transparent;
  }
}
.table-wrapper tbody tr.row-entering td.table-fixed,
.table-wrapper tbody tr.row-entering td.table-fixed-left,
.table-wrapper tbody tr.row-entering td.table-fixed-right {
  z-index: 3 !important;
  animation: row-enter-flash-sticky 1.15s ease;
}
.table-wrapper tbody tr.row-entering-bottom td.table-fixed,
.table-wrapper tbody tr.row-entering-bottom td.table-fixed-left,
.table-wrapper tbody tr.row-entering-bottom td.table-fixed-right {
  z-index: 3 !important;
  animation: row-enter-from-bottom-sticky 0.95s ease;
}
@keyframes row-enter-flash-sticky {
  0% {
    background-color: color-mix(in srgb, #0d6efd 42%, var(--bs-body-bg, #fff));
    box-shadow: inset 3px 0 0 #0d6efd;
  }
  45% {
    background-color: color-mix(in srgb, #198754 22%, var(--bs-body-bg, #fff));
    box-shadow: inset 3px 0 0 #198754;
  }
  100% {
    background-color: var(--bs-body-bg, #fff);
    box-shadow: inset 0 0 0 transparent;
  }
}
@keyframes row-enter-from-bottom-sticky {
  0% {
    background-color: color-mix(in srgb, #0d6efd 40%, var(--bs-body-bg, #fff));
    box-shadow: inset 0 -3px 0 #0d6efd;
    opacity: 0.15;
  }
  40% {
    background-color: color-mix(in srgb, #198754 22%, var(--bs-body-bg, #fff));
    box-shadow: inset 0 -3px 0 #198754;
    opacity: 1;
  }
  100% {
    background-color: var(--bs-body-bg, #fff);
    box-shadow: inset 0 0 0 transparent;
    opacity: 1;
  }
}
</style>
