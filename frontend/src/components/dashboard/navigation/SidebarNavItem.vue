<template>
  <div class="sidebar-nav-item" :class="itemClass">
    <router-link
      :to="'/dashboard/' + element.path"
      class="list-group-item list-group-item-action list-group-item-custom sidebar-nav-link p-3"
      :class="{ 'sidebar-nav-item-current': isActive }"
      :aria-current="isActive ? 'page' : undefined"
      @click="$emit('navigate')"
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
    <BasicButton
      v-if="showFavoriteControl"
      type="button"
      class="sidebar-favorite-toggle"
      :disabled="favoriteDisabled"
      :aria-label="favoriteLabel"
      :aria-pressed="isFavorite"
      :title="favoriteLabel"
      @click="$emit('toggle-favorite', element)"
    >
      <LoadIcon
        :icon-name="isFavorite ? 'pin-angle-fill' : 'pin-angle'"
        :size="16"
      />
    </BasicButton>
  </div>
</template>

<script>
/**
 * Single navigation link shared by the expanded submenu list and the hover preview list.
 *
 * @author Carly Gettinger, Dennis Zyska, Nils Dycke, Andrii Nikitin
 */
import LoadIcon from "@/basic/Icon.vue";
import BasicButton from "@/basic/Button.vue";

export default {
  name: "SidebarNavItem",
  components: { LoadIcon, BasicButton },
  props: {
    element: {
      type: Object,
      required: true,
    },
    variant: {
      type: String,
      required: true,
      validator: (value) => ["default", "preview", "favorite"].includes(value),
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    isFavorite: {
      type: Boolean,
      default: false,
    },
    favoriteDisabled: {
      type: Boolean,
      default: false,
    },
    showFavoriteControl: {
      type: Boolean,
      default: true,
    },
  },
  emits: ["toggle-favorite", "navigate"],
  computed: {
    itemClass() {
      return `${this.variant}-subitem`;
    },
    label() {
      const key = `sidebar.nav.${this.element.path}`;
      return this.$te(key) ? this.$t(key) : this.element.name;
    },
    favoriteLabel() {
      const key = this.isFavorite ? "sidebar.favorites.remove" : "sidebar.favorites.add";
      return this.$t(key, { name: this.label });
    },
  },
};
</script>

<style>
.sidebar-nav-item {
  position: relative;
  display: flex;
  min-width: 0;
}

.sidebar-nav-link {
  flex: 1;
  min-width: 0;
  padding-right: 2.75rem !important;
}

.sidebar-nav-link .list-group-item-text {
  overflow: hidden;
  text-overflow: ellipsis;
}

.default-subitem .sidebar-nav-link {
  padding-left: 2rem !important;
}

.preview-subitem .sidebar-nav-link {
  padding-left: 1rem !important;
}

.favorite-subitem .sidebar-nav-link {
  padding-left: 0.75rem !important;
}

.sidebar-nav-link:hover {
  background-color: var(--bs-body-bg, #fff) !important;
}

.sidebar-nav-link.router-link-active,
.sidebar-nav-link.router-link-exact-active,
.sidebar-nav-link.sidebar-nav-item-current {
  background-color: var(--bs-secondary-bg, #e0e0e0) !important;
  box-shadow: inset 2px 0 0 var(--bs-emphasis-color, #222);
}

.sidebar-favorite-toggle {
  position: absolute;
  z-index: 2;
  top: 50%;
  right: 0.4rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  transform: translateY(-50%);
  border: 0;
  border-radius: var(--bs-border-radius, 0.375rem);
  background: transparent !important;
  color: var(--bs-body-color, inherit);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease, color 0.15s ease;
}

.sidebar-nav-item:hover .sidebar-favorite-toggle,
.sidebar-nav-item:focus-within .sidebar-favorite-toggle,
.sidebar-favorite-toggle[aria-pressed="true"] {
  opacity: 1;
}

.sidebar-favorite-toggle:hover:not(:disabled) {
  background: transparent !important;
  box-shadow: none !important;
  color: var(--bs-emphasis-color, var(--bs-body-color, inherit));
}

.sidebar-favorite-toggle[aria-pressed="true"] {
  color: var(--bs-emphasis-color, var(--bs-body-color, inherit));
}

.sidebar-favorite-toggle[aria-pressed="true"]:hover:not(:disabled) {
  background: transparent !important;
  box-shadow: none !important;
  color: var(--bs-emphasis-color, var(--bs-body-color, inherit));
}

.sidebar-favorite-toggle:focus-visible {
  outline: 2px solid var(--bs-emphasis-color, currentColor);
  outline-offset: -2px;
  background: transparent !important;
  box-shadow: none !important;
  z-index: 1;
}

.sidebar-nav-link:focus-visible {
  outline: 2px solid var(--bs-primary, #0d6efd);
  outline-offset: -2px;
  z-index: 1;
}

.sidebar-favorite-toggle:disabled {
  cursor: wait;
}

.submenu-preview .sidebar-nav-link,
.submenu-preview .sidebar-nav-link:hover {
  background-color: var(--bs-tertiary-bg, #f2f2f2) !important;
  color: inherit;
}

.submenu-preview .sidebar-nav-link:hover {
  background-color: var(--bs-body-bg, #fff) !important;
}

.submenu-preview .sidebar-nav-link.router-link-active,
.submenu-preview .sidebar-nav-link.router-link-exact-active,
.submenu-preview .sidebar-nav-link.sidebar-nav-item-current {
  background-color: var(--bs-secondary-bg, #e0e0e0) !important;
}

#sidebar-wrapper.collapsed .sidebar-pinned-list .list-group-item-text {
  display: none !important;
}

#sidebar-wrapper.collapsed .sidebar-pinned-list .sidebar-nav-link {
  justify-content: center;
  padding-left: 0 !important;
  padding-right: 0 !important;
}

#sidebar-wrapper.collapsed .sidebar-pinned-list .sidebar-favorite-toggle {
  display: none !important;
}
</style>
