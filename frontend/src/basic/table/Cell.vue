<template>
  <TIcon
    v-if="column.type === 'icon'"
    :color="typeof value === 'object' ? value.color : null"
    :value="typeof value === 'object' ? value.icon : value"
    :title="typeof value === 'object' ? value.title : null"
    :size="column.typeOptions?.size ?? 16"
  />
  <TBadge
    v-else-if="column.type === 'badge'"
    :options="column.typeOptions ? column.typeOptions : null"
    :value="value"
  />
  <TButton
    v-else-if="column.type === 'button'"
    :action="value.action"
    :stats="value.stats"
    :icon="value.icon"
    :options="value.options"
    :params="row"
    :title="value.title"
    @action="(data) => $emit('action', data)"
  />
  <TToggle
    v-else-if="column.type === 'toggle'"
    :action="value.action"
    :value="value.value"
    :options="value.options"
    :params="row"
    :title="value.title"
    @action="(data) => $emit('action', data)"
  />
  <span v-else-if="column.type === 'datetime'">
    {{ formatLocalizedDateTime(value) }}
  </span>
  <span v-else-if="column.type === 'icon-selector'">
    <LoadIcon
      v-if="value.selected"
      :icon-name="value.icon"
      :size="16"
      style="color: yellowgreen"
    />
    <LoadIcon
      v-else
      v-tooltip
      :icon-name="value.icon"
      :size="16"
      :title="value.title"
      role="button"
      @click="$emit('action', { action: value.action, params: row })"
    />
  </span>
  <slot
    v-else
    name="text"
  >
    <span
      :class="{
        multiline: column.multiline,
      }"
      :style="multilineStyle"
    >
      {{ value }}
    </span>
  </slot>
</template>

<script>
import TButton from "./Button.vue";
import TToggle from "./Toggle.vue";
import TBadge from "./Badge.vue";
import TIcon from "./Icon.vue";
import LoadIcon from "@/basic/Icon.vue";
import { tooltip } from "@/assets/tooltip.js";
import { formatLocalizedDateTime } from "@/assets/utils";

/**
 * One body cell of BasicTable / BackendTable, rendered by `column.type`
 * (icon, badge, button, toggle, datetime, icon-selector, plain text).
 *
 * @author Andrii Nikitin
 */
export default {
  name: "TableCell",
  components: {
    TIcon,
    TBadge,
    TButton,
    TToggle,
    LoadIcon,
  },
  directives: { tooltip },
  props: {
    column: {
      type: Object,
      required: true,
    },
    row: {
      type: Object,
      required: true,
    },
  },
  emits: ["action"],
  computed: {
    value() {
      return this.row[this.column.key];
    },
    /** `multiline: true` clamps to 2 lines, a number to that many lines. */
    multilineStyle() {
      const multiline = this.column.multiline;
      if (!multiline) {
        return null;
      }
      return {
        "--line-clamp": multiline === true ? 2 : multiline,
      };
    },
  },
  methods: {
    formatLocalizedDateTime,
  },
};
</script>

<style scoped>
.multiline {
  display: -webkit-box;
  -webkit-line-clamp: var(--line-clamp, 2);
  line-clamp: var(--line-clamp, 2);
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal;
  word-break: break-word;
}
</style>
