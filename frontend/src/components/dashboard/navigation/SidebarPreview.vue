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
        :is-active="String(element.id) === String(activeElementId)"
        :is-favorite="isFavorite(element)"
        :favorite-disabled="favoriteDisabled"
        @toggle-favorite="$emit('toggle-favorite', $event)"
        @navigate="$emit('navigate')"
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
 * fallthrough.
 *
 * @author Carly Gettinger, Dennis Zyska, Nils Dycke, Andrii Nikitin
 */
import SidebarNavItem from "./SidebarNavItem.vue";

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
    activeElementId: {
      type: [Number, String],
      default: null,
    },
    favoriteIds: {
      type: Array,
      default: () => [],
    },
    favoriteDisabled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["toggle-favorite", "navigate"],
  computed: {
    groupLabel() {
      const key = `sidebar.nav.groups.${this.subgroup.name.toLowerCase()}`;
      return this.$te(key) ? this.$t(key) : this.subgroup.name;
    },
  },
  methods: {
    isFavorite(element) {
      return this.favoriteIds.includes(String(element.id));
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
  box-sizing: border-box;
  padding-left: 8px;
  padding-top: 8px;
  padding-bottom: 8px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: rgba(120, 120, 120, 0.45) transparent;
}

.submenu-preview-inner {
  min-width: min(220px, calc(100vw - 32px));
  max-width: 100%;
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

.submenu-preview::-webkit-scrollbar {
  width: 6px;
}

.submenu-preview::-webkit-scrollbar-track {
  background: transparent;
}

.submenu-preview::-webkit-scrollbar-thumb {
  background: rgba(120, 120, 120, 0.35);
  border-radius: 999px;
}

.submenu-preview:hover::-webkit-scrollbar-thumb {
  background: rgba(120, 120, 120, 0.5);
}

#sidebar-wrapper.collapsed .submenu-preview .list-group-item-text {
  display: block !important;
}

#sidebar-wrapper.collapsed .submenu-preview .sidebar-icon {
  margin-right: 12px;
  margin-left: -2px;
}
</style>
