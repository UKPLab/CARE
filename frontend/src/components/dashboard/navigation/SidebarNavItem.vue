<template>
  <router-link
    :to="'/dashboard/' + element.path"
    class="list-group-item list-group-item-action list-group-item-custom p-3"
    :class="itemClass"
  >
    <span
      class="sidebar-icon"
      :title="label"
    >
      <LoadIcon
        :icon-name="element.icon"
        :size="24"
      />
    </span>
    <div class="list-group-item-text">{{ label }}</div>
  </router-link>
</template>

<script>
/**
 * Single navigation link shared by the expanded submenu list and the hover preview list.
 *
 * @author Carly Gettinger, Dennis Zyska, Nils Dycke, Andrii Nikitin
 */
import LoadIcon from "@/basic/Icon.vue";
import { navElementLabel } from "./navLabels.js";

export default {
  name: "SidebarNavItem",
  components: { LoadIcon },
  props: {
    element: {
      type: Object,
      required: true,
    },
    variant: {
      type: String,
      required: true,
      validator: (value) => ['default', 'preview'].includes(value),
    },
  },
  computed: {
    itemClass() {
      return this.variant === 'preview' ? 'preview-subitem' : 'default-subitem';
    },
    label() {
      return navElementLabel(this.$t, this.$te, this.element);
    },
  },
};
</script>

<style>
.default-subitem {
  padding-left: 2.0rem !important;
}

.default-subitem.router-link-active,
.default-subitem.router-link-exact-active {
  background-color: var(--bs-secondary-bg, #e0e0e0) !important;
  box-shadow: inset 2px 0 0 var(--bs-emphasis-color, #222);
}

.preview-subitem {
  padding-left: 1rem !important;
}
</style>
