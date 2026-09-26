<template>
  <div class="default-subgroup">
    <!-- Subgroup header -->
    <div
      class="sidebar-subgroup-heading list-group-item-custom p-3"
      :class="{
        'collapsed-group-icon-active': isCollapsed && isActive,
        'expanded-group-active': !isCollapsed && isActive && !isOpen,
        'preview-group-active': isHovered && !isOpen
      }"
      :data-group-key="subgroup.key"
      @click="$emit('toggle')"
      @mouseenter="$emit('hover', $event)"
      @mouseleave="$emit('leave', $event)"
    >
      <!-- Expanded mode -->
      <div v-if="!isCollapsed" class="list-group-item-text subgroup-title">
        <span class="sidebar-icon subgroup-heading-icon" :title="groupLabel">
          <LoadIcon :icon-name="subgroup.icon" :size="22" />
        </span>
        {{ groupLabel }}
      </div>

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
    </div>

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
import SidebarNavItem from "./SidebarNavItem.vue";
import { navGroupLabel } from "./navLabels.js";

export default {
  name: "SidebarGroup",
  components: { LoadIcon, SidebarNavItem },
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
  },
  emits: ['toggle', 'hover', 'leave'],
  computed: {
    groupLabel() {
      return navGroupLabel(this.$t, this.$te, this.subgroup);
    },
    arrowClass() {
      return this.isOpen ? 'arrow-open' : 'arrow-close';
    },
  },
  methods: {

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

<style>
/* ========================================
   SIDEBAR GROUPS
======================================== */

.default-subgroup {
  position: relative;
}

.sidebar-subgroup-heading {
  display: flex !important;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  font-weight: 400;
  border: none;
  background-color: var(--bs-tertiary-bg, #f2f2f2);
  border-radius: 0;
  padding-right: 2.75rem !important;
}

.sidebar-subgroup-heading:hover {
  background-color: var(--bs-body-bg, #fff) !important;
}

.subgroup-title {
  font-weight: 400;
}

.subgroup-arrow {
  position: absolute;
  right: 0.5rem;
  display: flex;
  align-items: center;
  transform-origin: center;
}

.subgroup-heading-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  vertical-align: middle;
}

/* ========================================
   SUBMENU
======================================== */

.submenu-content {
  overflow: hidden;
}

.submenu-enter-active,
.submenu-leave-active {
  transition:
    height 320ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 280ms ease,
    transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

/* ========================================
   COLLAPSED MODE (heading-specific)
======================================== */

#sidebar-wrapper.collapsed > .sidebar-scroll-area .sidebar-subgroup-heading .list-group-item-text,
#sidebar-wrapper.collapsed .subgroup-arrow {
  display: none !important;
}

#sidebar-wrapper.collapsed .sidebar-subgroup-heading {
  justify-content: center !important;
  padding-left: 0 !important;
  padding-right: 0 !important;
  min-height: 52px;
  border-radius: 0;
}

.collapsed-group-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 25px;
  height: 25px;
}

/* ========================================
   ACTIVE / STATE STYLES
======================================== */

#sidebar-wrapper.collapsed .collapsed-group-icon-active {
  position: relative;
  background-color: var(--bs-secondary-bg, #e0e0e0) !important;
}

#sidebar-wrapper.collapsed .collapsed-group-icon-active::before {
  content: "";
  position: absolute;
  left: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 30px;
  background: rgba(20, 20, 20, 0.85);
}

#sidebar-wrapper:not(.collapsed) .expanded-group-active {
  position: relative;
  background-color: var(--bs-secondary-bg, #e0e0e0) !important;
}

#sidebar-wrapper:not(.collapsed) .expanded-group-active::before {
  content: "";
  position: absolute;
  left: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 30px;
  background: rgba(20, 20, 20, 0.85);
}

.sidebar-subgroup-heading.preview-group-active {
  background-color: var(--bs-body-bg, #fff) !important;
}

#sidebar-wrapper:not(.collapsed) .expanded-group-active.preview-group-active,
#sidebar-wrapper.collapsed .collapsed-group-icon-active.preview-group-active {
  background-color: var(--bs-body-bg, #fff) !important;
}

.arrow-open {
  animation: flip-horizontal-bottom 0.25s ease both;
}

.arrow-close {
  animation: flip-horizontal-top 0.25s ease both;
}

/* ========================================
   ANIMATIONS
======================================== */

@keyframes flip-horizontal-bottom {
  0% {
    transform: rotateX(0);
  }
  100% {
    transform: rotateX(180deg);
  }
}

@keyframes flip-horizontal-top {
  0% {
    transform: rotateX(180deg);
  }
  100% {
    transform: rotateX(0);
  }
}
</style>
