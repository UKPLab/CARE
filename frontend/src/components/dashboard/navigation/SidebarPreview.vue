<template>
  <div
    class="submenu-preview"
    :data-group-key="subgroup.key"
    :style="previewStyle"
  >
    <div class="submenu-preview-inner">
      <!-- Collapsed mode: preview header -->
      <div v-if="isCollapsed" class="submenu-preview-header">
        {{ groupLabel }}
      </div>

      <div v-if="isCollapsed" class="submenu-preview-divider" />

      <SidebarNavItem
        v-for="element in subgroup.elements"
        :key="`preview-${element.id}`"
        :element="element"
        variant="preview"
      />
    </div>
  </div>
</template>

<script>
/**
 * Single shared floating preview of a subgroup's links, shown when the sidebar is
 * collapsed or when a closed group is hovered. Only ever one instance is rendered,
 * conditionally, by Sidebar.vue - never one per group.
 *
 * mouseenter/mouseleave listeners bound on <SidebarPreview> by the parent attach
 * directly to this component's single root element via Vue's attribute/listener
 * fallthrough, so no explicit emits are declared here.
 *
 * @author Carly Gettinger, Dennis Zyska, Nils Dycke, Andrii Nikitin
 */
import SidebarNavItem from "./SidebarNavItem.vue";
import { navGroupLabel } from "./navLabels.js";

export default {
  name: "SidebarPreview",
  components: { SidebarNavItem },
  props: {
    subgroup: {
      type: Object,
      required: true,
    },
    isCollapsed: {
      type: Boolean,
      required: true,
    },
    previewStyle: {
      type: Object,
      required: true,
    },
  },
  computed: {
    groupLabel() {
      return navGroupLabel(this.$t, this.$te, this.subgroup);
    },
  },
};
</script>

<style>

/* ========================================
   SUBMENU PREVIEW
======================================== */

.submenu-preview {
  position: fixed;
  z-index: 9999;
  padding-left: 8px;
  padding-top: 8px;
  padding-bottom: 8px;
}

.submenu-preview-inner {
  min-width: 220px;
  background: var(--bs-tertiary-bg, #ebebeb);
  color: inherit;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow:
    0 8px 18px rgba(0, 0, 0, 0.08),
    0 2px 6px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  clip-path: inset(0 round 12px);
}

.submenu-preview-header {
  padding: 0.95rem 1rem 0.75rem;
  font-size: 1rem;
  font-weight: 600;
  background: var(--bs-tertiary-bg, #f2f2f2);
  color: inherit;
}

.submenu-preview-divider {
  height: 1px;
  background: rgba(0, 0, 0, 0.08);
}

.submenu-preview .preview-subitem {
  border-radius: 0 !important;
}

.submenu-preview .preview-subitem:first-child,
.submenu-preview .preview-subitem:last-child {
  border-radius: 0 !important;
}

.submenu-preview .list-group-item-custom {
  background-color: var(--bs-tertiary-bg, #f2f2f2) !important;
  color: inherit;
}

.submenu-preview .list-group-item-custom:hover {
  background-color: var(--bs-body-bg, #fff) !important;
}

.submenu-preview .preview-subitem.router-link-active,
.submenu-preview .preview-subitem.router-link-exact-active {
  background-color: var(--bs-secondary-bg, #e0e0e0) !important;
  box-shadow: inset 2px 0 0 var(--bs-emphasis-color, #222);
}

#sidebar-wrapper.collapsed .submenu-preview .list-group-item-text {
  display: block !important;
}

#sidebar-wrapper.collapsed .submenu-preview .sidebar-icon {
  margin-right: 12px;
  margin-left: -2px;
}
</style>
