<template>
  <tr @click="controller.selectRow(row)">
    <td v-if="controller.selectableRows">
      <div
        class="form-check"
        @click.stop=""
      >
        <input
          class="form-check-input"
          type="checkbox"
          :class="{
            pointer: controller.selectableRows && !row.isDisabled,
          }"
          :disabled="row.isDisabled"
          :checked="controller.isRowSelected(row)"
          @change="(e) => controller.selectRow(row)"
        />
      </div>
    </td>
    <td
      v-for="(c, index) in controller.visibleColumns"
      :key="c.key"
      :class="[
        'width' in c ? 'col-' + c.width : 'col-auto',
        { pointer: controller.selectableRows && !row.isDisabled },
        controller.getFixedColumnClass(c, index),
      ]"
      :style="[controller.getFixedColumnStyle(c), c.style || {}]"
    >
      <span v-if="c.key in row">
        <TCell
          :column="c"
          :row="row"
          @action="controller.actionEmitter"
        />
      </span>
      <span v-else> - </span>
    </td>
    <td
      v-if="controller.getFilteredButtons(row).length > 0"
      :class="controller.getManageColumnClass()"
      :style="controller.manageColumnStyle"
      @click.stop=""
    >
      <TButtonGroup
        :buttons="controller.getFilteredButtons(row)"
        :params="row"
        @action="controller.actionEmitter"
      />
    </td>
  </tr>
</template>

<script>
import TButtonGroup from "./ButtonGroup.vue";
import TCell from "./Cell.vue";

/**
 * One data row of BasicTable (Table.vue): selection checkbox, cells and row buttons.
 * Selection, layout and actions stay on the table, injected as `controller`.
 */
export default {
  name: "BasicTableRow",
  components: { TButtonGroup, TCell },
  inject: { controller: { from: "basicTableController" } },
  props: {
    row: { type: Object, required: true },
  },
};
</script>

<style scoped src="./table.css"></style>

<style scoped>
.form-check-input:disabled {
  cursor: not-allowed;
  pointer-events: initial;
  opacity: 0.5;
  background-color: var(--bs-secondary-bg, #d8d8d8);
  border: 1px solid var(--bs-border-color, gray);
}
</style>
