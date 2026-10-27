<template>
  <nav class="dashboard-topnav" @keydown.esc="hoveredKey = null">
    <div
      v-for="group in groups"
      :key="group.key"
      @mouseenter="showGroup(group.key, $event)"
      @mouseleave="scheduleClose"
    >
      <button
        type="button"
        class="dashboard-topnav-group-btn"
        :class="{
          active: activeGroup === group.key,
          open: hoveredKey === group.key,
        }"
        :aria-expanded="hoveredKey === group.key ? 'true' : 'false'"
        @focus="showGroup(group.key, $event)"
      >
        {{ groupLabel(group) }}
      </button>
    </div>
    <Teleport to="body">
      <div
        v-if="openGroup"
        class="dashboard-topnav-menu"
        :style="menuStyle"
        @mouseenter="cancelClose"
        @mouseleave="scheduleClose"
      >
        <router-link
          v-for="element in openGroup.elements"
          :key="element.id"
          class="dashboard-topnav-link"
          :to="'/dashboard/' + element.path"
          @click="hoveredKey = null"
        >
          {{ elementLabel(element) }}
        </router-link>
      </div>
    </Teleport>
  </nav>
</template>

<script>
/**
 * Dashboard page menu. Groups and pages come from nav_group and nav_element.
 * Rendered in the top bar on dashboard routes; hovering a group opens its pages.
 * @author Carly Gettinger, Dennis Zyska, Nils Dycke, Andrii Nikitin
 */
import { navElementLabel, navGroupLabel } from "./helpers/navLabels.js";

export default {
  subscribeTable: ['nav_group', 'nav_element'],
  name: "SidebarNavigation",

  data() {
    return {
      hoveredKey: null,
      menuStyle: {},
      closeTimer: null,
    };
  },

  computed: {
    isAdmin() {
      return this.$store.getters['auth/isAdmin'];
    },

    // nav elements the user may see, grouped by groupId and sorted by order
    elementsByGroup() {
      const byGroup = {};
      this.$store.getters['table/nav_element/getAll']
        .filter(element => (!element.admin || this.isAdmin)
          && this.$store.getters["auth/checkRight"](`frontend.dashboard.${element.path}.view`))
        .forEach(element => {
          (byGroup[element.groupId] = byGroup[element.groupId] || []).push(element);
        });
      Object.values(byGroup).forEach(elements => elements.sort((a, b) => a.order - b.order));
      return byGroup;
    },

    groups() {
      return this.$store.getters['table/nav_group/getAll']
        .filter(group => (!group.admin || this.isAdmin) && group.name !== 'Default' && group.name !== 'Admin')
        .sort((a, b) => a.order - b.order)
        .map(group => ({
          key: group.name,
          name: group.name,
          elements: this.elementsByGroup[group.id] || [],
        }))
        .filter(group => group.elements.length > 0);
    },

    openGroup() {
      return this.groups.find(group => group.key === this.hoveredKey) || null;
    },

    activeGroup() {
      const path = this.$route.path.toLowerCase().replace(/\/$/, '');
      const currentPath = path === '/dashboard' ? '/dashboard/home' : path;
      return this.groups.find(group => group.elements
        .some(el => currentPath === `/dashboard/${el.path}`.toLowerCase()))?.key || null;
    },
  },

  watch: {
    $route() {
      this.hoveredKey = null;
    },
  },

  mounted() {
    document.body.classList.add('sidebar-exists');
  },

  beforeUnmount() {
    document.body.classList.remove('sidebar-exists');
    this.cancelClose();
  },

  methods: {
    showGroup(groupName, event) {
      this.cancelClose();
      this.hoveredKey = groupName;
      const button = event.currentTarget.querySelector(".dashboard-topnav-group-btn") || event.currentTarget;
      const rect = button.getBoundingClientRect();
      this.menuStyle = {
        top: `${rect.bottom + 6}px`,
        left: `${Math.min(rect.left, window.innerWidth - 220)}px`,
      };
    },

    scheduleClose() {
      this.cancelClose();
      this.closeTimer = setTimeout(() => {
        this.hoveredKey = null;
      }, 220);
    },

    cancelClose() {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    },

    groupLabel(group) {
      return navGroupLabel(this.$t, this.$te, group);
    },

    elementLabel(element) {
      return navElementLabel(this.$t, this.$te, element);
    },
  },
};
</script>

<style>
.dashboard-topnav {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  flex: 1 1 auto;
  overflow-x: auto;
  scrollbar-width: none;
}

.dashboard-topnav-group-btn {
  position: relative;
  height: 32px;
  border: 0;
  background: transparent;
  border-radius: 8px;
  padding: 0 10px;
  font-size: .875rem;
  font-weight: 500;
  white-space: nowrap;
  color: var(--bs-secondary-color);
  transition: background-color var(--care-dur-fast) var(--care-ease), color var(--care-dur-fast) var(--care-ease);
}

.dashboard-topnav-group-btn:hover,
.dashboard-topnav-group-btn.open {
  background: var(--bs-secondary-bg);
  color: var(--bs-body-color);
}

/* Accent line (yellow in dark mode, blue in light mode) that grows from the centre to both
   edges of the category on hover / keyboard focus and stays while its menu is open, so the
   chosen category is easy to see. */
.dashboard-topnav-group-btn::after,
.dashboard-topnav-group-btn::before {
  content: "";
  position: absolute;
  left: 6px;
  right: 6px;
  pointer-events: none;
  transform: scaleX(0);
  transform-origin: center;
  opacity: 0;
  transition: transform .5s var(--care-ease), opacity .3s ease;
}

/* The line: bright core that fades out towards both ends */
.dashboard-topnav-group-btn::after {
  bottom: 2px;
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    color-mix(in srgb, var(--care-primary) 60%, transparent) 14%,
    var(--care-primary) 50%,
    color-mix(in srgb, var(--care-primary) 60%, transparent) 86%,
    transparent 100%
  );
  filter: drop-shadow(0 0 4px color-mix(in srgb, var(--care-primary) 75%, transparent));
}

/* A soft glow rising from the line into the button */
.dashboard-topnav-group-btn::before {
  bottom: 0;
  height: 14px;
  background: radial-gradient(
    ellipse 55% 100% at 50% 100%,
    color-mix(in srgb, var(--care-primary) 26%, transparent),
    transparent 75%
  );
  transition-duration: .6s, .4s;
}

.dashboard-topnav-group-btn:hover::after,
.dashboard-topnav-group-btn:focus-visible::after,
.dashboard-topnav-group-btn.open::after,
.dashboard-topnav-group-btn:hover::before,
.dashboard-topnav-group-btn:focus-visible::before,
.dashboard-topnav-group-btn.open::before {
  transform: scaleX(1);
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .dashboard-topnav-group-btn::after,
  .dashboard-topnav-group-btn::before {
    transition: none;
  }
}

.dashboard-topnav-group-btn.active,
.dashboard-topnav-link.router-link-active {
  background: color-mix(in srgb, var(--care-primary) 14%, transparent);
  color: var(--care-primary);
}

.dashboard-topnav-group-btn:focus-visible,
.dashboard-topnav-link:focus-visible {
  outline: none;
  box-shadow: var(--care-focus-ring);
}

.dashboard-topnav-menu {
  position: fixed;
  min-width: 200px;
  padding: 4px;
  background: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color-translucent);
  border-radius: 12px;
  box-shadow: var(--care-shadow-3);
  z-index: 2000;
  animation: dashboard-topnav-in var(--care-dur-fast) var(--care-ease);
}

.dashboard-topnav-link {
  display: block;
  border-radius: 8px;
  padding: 8px 10px;
  color: var(--bs-body-color);
  text-decoration: none;
  font-size: .875rem;
}

.dashboard-topnav-link:hover {
  background: var(--bs-secondary-bg);
  color: var(--bs-body-color);
}

.dashboard-topnav-link.router-link-active {
  font-weight: 600;
}

@keyframes dashboard-topnav-in {
  from { opacity: 0; transform: translateY(-4px); }
}
</style>
