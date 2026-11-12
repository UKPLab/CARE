<template>
  <div class="btn-group btn-group-sm row-actions">
    <TableButton
      v-for="b in actions.inline"
      :key="b.action"
      class="btn-icon"
      :class="{ 'btn-icon-danger': isDanger(b) }"
      :action="b.action"
      :icon="b.icon"
      :options="b.options"
      :params="params"
      :stats="b.stats"
      :title="b.title"
      @action="actionEmitter"
    />
    <!-- The menu is teleported: the table wrapper clips overflow and sticky cells stack above rows. -->
    <BasicPopupMenu
      v-if="actions.menu.length > 0"
      trigger-class="btn-icon row-actions-more"
      :items="menuItems"
      @select="menuAction"
    />
  </div>
</template>

<script>
import TableButton from "./Button.vue";
import BasicPopupMenu from "@/basic/PopupMenu.vue";
import { isDangerButton, rowMenuItems, splitRowActions } from "./helpers/rowActionsLayout.js";

/**
 * Row actions for the table manage column.
 *
 * Shows the main actions as icons and collapses the rest into a "more" (three dots)
 * menu, like the study cards. Destructive actions (btn-outline-danger) always come
 * last and are never promoted inline while there is a menu, so delete is never the
 * first icon in a row.
 *
 * Layout options (`layout` prop, usually `options.rowActions` of the table):
 * - `maxInline`: icons kept inline (default 3). One extra action is shown inline
 *   instead of a menu holding a single entry. Use `Infinity` to never collapse.
 * - `inline`: action names to prefer inline, in this order (e.g. the page's main action).
 * - `menuOnly`: action names that always go into the menu.
 */
export default {
  name: "ButtonGroup",
  components: { TableButton, BasicPopupMenu },
  props: {
    buttons: {
      type: Array,
      required: true,
    },
    params: {
      type: Object,
      required: false,
      default: null,
    },
    layout: {
      type: Object,
      required: false,
      default: () => ({}),
    },
  },
  emits: ["action"],
  computed: {
    actions() {
      return splitRowActions(this.buttons, this.layout);
    },
    menuItems() {
      return rowMenuItems(this.actions.menu);
    },
  },
  methods: {
    isDanger: isDangerButton,
    actionEmitter(data) {
      this.$emit("action", data);
    },
    /**
     * Emit a menu entry like an inline button click.
     * @param {Object} button Row button picked in the menu.
     * @returns {void}
     */
    menuAction(button) {
      this.$emit("action", { action: button.action, params: this.params, stats: button.stats });
    },
  },
};
</script>

<style scoped>
.row-actions {
  flex-wrap: nowrap;
  gap: 2px;
}

/* Rows keep 30px icon buttons; !important beats btn-group's joined corners. */
.row-actions > .btn-icon,
.row-actions :deep(.row-actions-more) {
  min-width: 30px;
  height: 30px;
  padding: 0 0.4rem;
  border-radius: var(--care-radius-md) !important;
}
</style>
