<template>
  <Loading v-if="sidebarElements > 0 || sidebarGroups > 0 " />

  <!-- Sidebar layout -->
  <div
    v-else
    id="wrapper"
    class="nav-container"
  >
    <div
      id="sidebar-wrapper"
      :class="{ collapsed: isCollapsed }"
    >
      <!-- Sidebar navigation -->
      <div class="sidebar-scroll-area">
        <div class="list-group-test">
          <span>
            <SidebarGroup
              v-for="subgroup in defaultGroupedElements"
              :key="subgroup.key"
              :subgroup="subgroup"
              :is-collapsed="isCollapsed"
              :is-open="!!groupStates[subgroup.key]"
              :is-active="activeSubgroup === subgroup.key"
              :is-hovered="hoveredGroup === subgroup.key"
              @toggle="toggleGroup(subgroup.key)"
              @hover="handleGroupMouseEnter($event, subgroup.key)"
              @leave="handleGroupMouseLeave($event, subgroup.key)"
            />
          </span>
        </div>
      </div>

      <!-- Hover preview: single shared instance -->
      <SidebarPreview
        v-if="hoveredSubgroup && !groupStates[hoveredGroup]"
        :subgroup="hoveredSubgroup"
        :is-collapsed="isCollapsed"
        :preview-style="previewStyle"
        @mouseenter="handlePreviewMouseEnter"
        @mouseleave="handlePreviewMouseLeave($event, hoveredGroup)"
      />

      <!-- Sidebar footer -->
      <div v-if="isAdmin && !isCollapsed" class="text-center text-secondary">
        {{ $t('common.appVersion') }}: {{ version }}
      </div>

      <div
        class="collapse-sidebar-container list-group-item-action list-group-item list-group-item-custom"
        :title="$t('navigation.sidebar.toggleSidebar')"
        @click="toggleSidebar()"
      >
        <span class="arrow-toggle sidebar-icon">
          <LoadIcon name="chevron-double-right" />
        </span>

        <!-- Expanded mode -->
        <div v-if="!isCollapsed" class="list-group-item-text" style="cursor:pointer">
          {{ $t('navigation.sidebar.collapseSidebar') }}
        </div>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * Sidebar for page selection
 *
 * This component provides left toggleable side toolbar.
 *
 * adapted simple sidebar found at https://github.com/StartBootstrap/startbootstrap-simple-sidebar
 *
 * @author Carly Gettinger, Dennis Zyska, Nils Dycke, Andrii Nikitin
 */
import LoadIcon from "@/basic/Icon.vue";
import Loading from "@/basic/Loading.vue";
import SidebarGroup from "./SidebarGroup.vue";
import SidebarPreview from "./SidebarPreview.vue";
import { sidebarHoverPreviewData, sidebarHoverPreviewComputed, sidebarHoverPreviewMethods } from "./sidebarHoverPreview.js";

export default {
  subscribeTable: ['nav_group', 'nav_element'],
  name: "SidebarNavigation",
  components: { LoadIcon, Loading, SidebarGroup, SidebarPreview },

  data() {
    return {
      version: APP_VERSION,
      isCollapsed: false,

      // Stores open/closed state per subgroup, e.g.:
      // { Home: true, Study: false, ... }
      groupStates: {},

      // Hover preview state (hoveredGroup/previewStyle/isHoveringPreview),
      // physically declared in sidebarHoverPreview.js, spread in here
      ...sidebarHoverPreviewData(),
    };
  },

  computed: {
    /* ========================================
       Store data
    ======================================== */

    sidebarElements() {
      const groups = this.$store.getters['table/nav_element/getAll']
        .filter(element => {
          const hasRight = this.$store.getters["auth/checkRight"](
            `frontend.dashboard.${element.path}.view`
          );
          return (!element.admin || this.isAdmin) && hasRight;
        })
        .reduce((acc, cur) => {
          if (cur.groupId === 0 || cur.groupId === undefined) {
            console.error(
              "For navigation element " + cur.name + " the group id " + cur.group + " doesn't exists!"
            );
          } else {
            if (cur["groupId"] !== undefined) {
              acc[cur["groupId"]] = acc[cur["groupId"]] || [];
              acc[cur['groupId']].push(cur);
            }
          }
          return acc;
        }, []);

      return groups.map(e =>
        e.sort(function (a, b) {
          return a["order"] - b["order"];
        })
      );
    },

    sidebarGroups() {
      const groups = this.$store.getters['table/nav_group/getAll']
        .filter(group => !group.admin || this.isAdmin);

      return groups.sort(function (a, b) {
        return a["order"] - b["order"];
      });
    },

    isAdmin() {
      return this.$store.getters['auth/isAdmin'];
    },

    /* ========================================
       Sidebar grouping
    ======================================== */

    // builds sidebar groups from nav_group and filters out empty groups
    defaultGroupedElements() {
      return this.sidebarGroups
        .filter(group => group.name !== 'Default' && group.name !== 'Admin')
        .map(group => ({
          key: group.name,
          name: group.name,
          icon: group.icon,
          elements: (this.sidebarElements[group.id] || []),
        }))
        .filter(group => group.elements.length > 0);
    },

    activeSubgroup() {
      const currentPath = this.$route.path.toLowerCase();
      const currentElement = this.$store.getters['table/nav_element/getAll']
        .find(el => currentPath === `/dashboard/${el.path}`.toLowerCase());

      if (!currentElement) return null;

      const group = this.sidebarGroups.find(g => g.id === currentElement.groupId);

      return group?.name || null;
    },

    // Hover-preview coordination (hoveredSubgroup), spread in from sidebarHoverPreview.js
    ...sidebarHoverPreviewComputed,
  },

  watch: {
    defaultGroupedElements(newGroups) {
      newGroups.forEach(group => {
        if (!(group.key in this.groupStates)) {
          this.groupStates[group.key] = false;
        }
      });
    },
    $route(to) {
      const toPath = to.path.toLowerCase().replace(/\/$/, '');

      this.resetPreview();

      this.$nextTick(() => {
        requestAnimationFrame(() => {
          if (toPath === '/dashboard') {
            this.closeAllGroups();
          } else {
            this.syncSidebarWithRoute();
          }
        });
      });
    },
  },

  mounted() {
    document.body.classList.add('sidebar-exists');

    this.initGroupStates();
    this.syncSidebarWithRoute();
  },

  beforeUnmount() {
    document.body.classList.remove('sidebar-exists');
  },

  methods: {
    /* ========================================
       Group state
    ======================================== */

    _setGroupState(groupName, isOpen) {
      if (groupName in this.groupStates) {
        this.groupStates[groupName] = isOpen;
      }
    },

    closeAllGroups() {
      this.resetPreview();

      Object.keys(this.groupStates).forEach(name => this._setGroupState(name, false));
    },

    setExpandedGroup(groupName) {
      if (!groupName) {
        return;
      }

      this.resetPreview();

      if (!this.isCollapsed) {
        this._setGroupState(groupName, true);
      }
    },

    // Opens only the subgroup that belongs to the current route
    // and closes all others
    setOnlyExpandedGroup(groupName) {
      if (!groupName) {
        return;
      }

      this.resetPreview();

      Object.keys(this.groupStates).forEach(name =>
        this._setGroupState(name, name === groupName && !this.isCollapsed)
      );
    },

    toggleGroup(groupName) {
      if (this.isCollapsed) {
        return;
      }

      const isOpening = !this.groupStates[groupName];

      this.resetPreview();

      this._setGroupState(groupName, isOpening);
    },

    /* ========================================
       Sidebar actions
    ======================================== */

    toggleSidebar() {
      this.isCollapsed = !this.isCollapsed;
      document.body.classList.toggle('sb-sidenav-toggled', this.isCollapsed);

      this.resetPreview();

      if (this.isCollapsed) {
        this.closeAllGroups();
      } else {
        this.syncSidebarWithRoute();
      }
    },

    syncSidebarWithRoute() {
      const currentPath = this.$route.path.toLowerCase().replace(/\/$/, '');

      if (currentPath === '/dashboard') {
        return;
      }

      this.resetPreview();

      if (this.activeSubgroup) {
        this.setOnlyExpandedGroup(this.activeSubgroup);
      }
    },

    /* ========================================
       Helpers
    ======================================== */

    //initializes groupStates from store groups
    initGroupStates() {
      this.defaultGroupedElements.forEach(group => {
        if (!(group.key in this.groupStates)) {
          this.groupStates[group.key] = false;
        }
      });
    },

    // Hover-preview coordination (resetPreview, handleGroupMouseEnter/Leave,
    // handlePreviewMouseEnter/Leave, _isRelatedTargetInGroup), spread in from
    // sidebarHoverPreview.js
    ...sidebarHoverPreviewMethods,
  },
};
</script>

<style>
/* ========================================
   1. ROOT LAYOUT
======================================== */

#wrapper {
  height: 100%;
  background-color: var(--bs-tertiary-bg, #f2f2f2);
}

#sidebar-wrapper {
  position: relative;
  -webkit-transition: width .25s ease-out;
  -moz-transition: width .25s ease-out;
  -o-transition: width .25s ease-out;
  transition: width .25s ease-out;
  transition-delay: 0.1s;
  overflow: visible;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  width: 13rem;

  /* Firefox */
  scrollbar-width: thin;
  scrollbar-color: rgba(120, 120, 120, 0.45) transparent;
}

.sidebar-scroll-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: visible;
  scrollbar-gutter: stable;

  scrollbar-width: thin;
  scrollbar-color: rgba(120, 120, 120, 0.45) transparent;
}

.collapse-sidebar-container {
  border-top: 1px solid rgba(0, 0, 0, 0.125);
}

@media (min-width: 768px) {
  #wrapper #sidebar-wrapper.collapsed {
    width: 64px;
  }
}

/* ========================================
   2. SCROLLBARS
======================================== */

/* Chrome / Edge / Safari */
#sidebar-wrapper::-webkit-scrollbar {
  width: 6px;
}

#sidebar-wrapper::-webkit-scrollbar-track {
  background: transparent;
}

#sidebar-wrapper::-webkit-scrollbar-thumb {
  background: rgba(120, 120, 120, 0.35);
  border-radius: 999px;
  transition: background 0.2s ease;
}

#sidebar-wrapper:hover::-webkit-scrollbar-thumb {
  background: rgba(120, 120, 120, 0.5);
}

#sidebar-wrapper::-webkit-scrollbar-thumb:hover {
  background: rgba(120, 120, 120, 0.7);
}

.sidebar-scroll-area::-webkit-scrollbar {
  width: 6px;
}

.sidebar-scroll-area::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-scroll-area::-webkit-scrollbar-thumb {
  background: rgba(120, 120, 120, 0.35);
  border-radius: 999px;
  transition: background 0.2s ease;
}

.sidebar-scroll-area:hover::-webkit-scrollbar-thumb {
  background: rgba(120, 120, 120, 0.5);
}

.sidebar-scroll-area::-webkit-scrollbar-thumb:hover {
  background: rgba(120, 120, 120, 0.7);
}

/* ========================================
   3. BASE ELEMENTS (shared across Sidebar.vue, SidebarGroup.vue,
      SidebarNavItem.vue and SidebarPreview.vue)
======================================== */

.list-group-item-custom {
  display: flex !important;
  justify-content: flex-start;
  align-items: center;
  flex-shrink: 0;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  border: none;
  background-color: var(--bs-tertiary-bg, #f2f2f2);
}

.list-group-item:hover {
  background-color: var(--bs-body-bg, #fff) !important;
}

.sidebar-icon {
  height: 25px;
  width: 25px;
  flex-shrink: 0;
  margin-right: 12px;
  margin-left: -2px;
}

/* ========================================
   4. COLLAPSED SIDEBAR MODE (own markup only;
      SidebarGroup.vue/SidebarPreview.vue own their collapsed-mode rules)
======================================== */

#sidebar-wrapper.collapsed > .collapse-sidebar-container .list-group-item-text,
#sidebar-wrapper.collapsed > .text-secondary {
  display: none !important;
}

#sidebar-wrapper.collapsed .collapse-sidebar-container {
  justify-content: center !important;
  padding-left: 0 !important;
  padding-right: 0 !important;
}

#sidebar-wrapper.collapsed .sidebar-icon {
  margin-right: 0;
  margin-left: 0;
}

/* ========================================
   5. FOOTER / STATE STYLES
======================================== */

.arrow-toggle {
  transform: rotate(180deg);
}

body.sb-sidenav-toggled .arrow-toggle {
  transform: rotate(0deg);
}
</style>
