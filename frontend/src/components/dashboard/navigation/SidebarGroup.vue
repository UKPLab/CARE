<template>
  <div class="default-subgroup">
    <!-- Subgroup header -->
    <BasicButton
      ref="heading"
      class="sidebar-subgroup-heading list-group-item-custom p-3"
      :aria-label="groupLabel"
      :title="groupLabel"
      :aria-expanded="isOpen"
      :class="{
        'collapsed-group-icon-active': isCollapsed && isActive,
        'expanded-group-active': !isCollapsed && isActive && !isOpen,
        'preview-group-active': isHovered && !isOpen
      }"
      :data-group-key="subgroup.key"
      @click="toggleGroup"
    >
      <!-- Expanded mode -->
      <span v-if="!isCollapsed" class="list-group-item-text subgroup-title">
        <span class="sidebar-icon subgroup-heading-icon" :title="groupLabel">
          <LoadIcon :icon-name="subgroup.icon" :size="22" />
        </span>
        {{ groupLabel }}
      </span>

      <!-- Expanded mode: subgroup arrow -->
      <span
        v-if="!isCollapsed"
        class="subgroup-arrow"
        :class="arrowClass"
      >
        <LoadIcon icon-name="chevron-down" />
      </span>

      <!-- Collapsed mode -->
      <span
        v-else
        class="sidebar-icon collapsed-group-icon"
        :title="groupLabel"
      >
        <LoadIcon :icon-name="subgroup.icon" :size="24" />
      </span>
    </BasicButton>

    <!-- Expanded subgroup content -->
    <transition
      name="submenu"
      @enter="enterSubmenu"
      @leave="leaveSubmenu"
    >
      <div
        v-if="isOpen && !isCollapsed"
        class="submenu-content"
      >
        <SidebarNavItem
          v-for="element in subgroup.elements"
          :key="element.id"
          :element="element"
          variant="default"
          :is-active="String(element.id) === String(activeElementId)"
          :is-favorite="isFavorite(element)"
          :favorite-disabled="favoriteDisabled"
          @toggle-favorite="$emit('toggle-favorite', $event)"
        />
      </div>
    </transition>
  </div>
</template>

<script>
/**
 * One sidebar subgroup: heading (expand/collapse click target, active-state styling)
 * and its expanded submenu list. Group-open state is owned by the parent Sidebar.vue
 * (needed for cross-group coordination) and passed in as the isOpen prop.
 *
 * @author Carly Gettinger, Dennis Zyska, Nils Dycke, Andrii Nikitin
 */
import LoadIcon from "@/basic/Icon.vue";
import BasicButton from "@/basic/Button.vue";
import SidebarNavItem from "./SidebarNavItem.vue";

export default {
  name: "SidebarGroup",
  components: { LoadIcon, BasicButton, SidebarNavItem },
  props: {
    subgroup: {
      type: Object,
      required: true,
    },
    isCollapsed: {
      type: Boolean,
      required: true,
    },
    isOpen: {
      type: Boolean,
      required: true,
    },
    isActive: {
      type: Boolean,
      required: true,
    },
    isHovered: {
      type: Boolean,
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
  emits: ['toggle', 'hover', 'leave', 'toggle-favorite'],
  computed: {
    groupLabel() {
      const key = `sidebar.nav.groups.${this.subgroup.name.toLowerCase()}`;
      return this.$te(key) ? this.$t(key) : this.subgroup.name;
    },
    arrowClass() {
      return this.isOpen ? 'arrow-open' : 'arrow-close';
    },
  },
  mounted() {
    const heading = this.$refs.heading?.$el;
    heading?.addEventListener("mouseenter", this.handleMouseEnter);
    heading?.addEventListener("mouseleave", this.handleMouseLeave);
  },
  beforeUnmount() {
    const heading = this.$refs.heading?.$el;
    heading?.removeEventListener("mouseenter", this.handleMouseEnter);
    heading?.removeEventListener("mouseleave", this.handleMouseLeave);
  },
  methods: {
    handleMouseEnter(event) {
      this.$emit("hover", event);
    },
    handleMouseLeave(event) {
      this.$emit("leave", event);
    },
    toggleGroup() {
      this.$emit("toggle", this.$refs.heading?.$el);
    },

    isFavorite(element) {
      return this.favoriteIds.includes(String(element.id));
    },

    /* ========================================
       Submenu animation
    ======================================== */

    // Manual height animation is used here instead of pure CSS auto-height,
    // because auto cannot be smoothly animated
    enterSubmenu(el) {
      el.style.height = '0';
      el.style.opacity = '0';
      el.style.transform = 'translateY(-4px)';

      requestAnimationFrame(() => {
        el.style.height = `${el.scrollHeight}px`;
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      });
    },

    leaveSubmenu(el) {
      el.style.height = `${el.scrollHeight}px`;
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';

      requestAnimationFrame(() => {
        el.style.height = '0';
        el.style.opacity = '0';
        el.style.transform = 'translateY(-4px)';
      });
    },
  },
};
</script>

<style src="./sidebarGroup.css"></style>
