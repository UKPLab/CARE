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
      <SidebarGroupList
        :groups="defaultGroupedElements"
        :group-states="groupStates"
        :is-collapsed="isCollapsed"
        :active-group="activeSubgroup"
        :hovered-group="hoveredGroup"
        :active-element-id="activeElementId"
        :favorite-ids="favoriteIds"
        :favorite-disabled="isSavingFavorites"
        @toggle="toggleGroup"
        @hover="handleGroupMouseEnter"
        @leave="handleGroupMouseLeave"
        @toggle-favorite="toggleFavorite"
      >
        <SidebarFavorites
          :elements="favoriteElements"
          :active-element-id="activeElementId"
          :is-collapsed="isCollapsed"
          :favorite-disabled="isSavingFavorites"
          @toggle-favorite="toggleFavorite"
        />
      </SidebarGroupList>

      <!-- Hover preview: single shared instance -->
      <SidebarPreview
        v-if="hoveredSubgroup && !groupStates[hoveredGroup]"
        ref="sidebarPreview"
        :subgroup="hoveredSubgroup"
        :is-collapsed="isCollapsed"
        :preview-style="previewStyle"
        :active-element-id="activeElementId"
        :favorite-ids="favoriteIds"
        :favorite-disabled="isSavingFavorites"
        @mouseenter="handlePreviewMouseEnter"
        @mouseleave="handlePreviewMouseLeave($event, hoveredGroup)"
        @toggle-favorite="toggleFavorite"
      />

      <SidebarFooter
        :is-collapsed="isCollapsed"
        :show-version="isAdmin"
        @toggle="toggleSidebar()"
      />
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
import Loading from "@/basic/Loading.vue";
import SidebarGroupList from "./SidebarGroupList.vue";
import SidebarFavorites from "./SidebarFavorites.vue";
import SidebarPreview from "./SidebarPreview.vue";
import SidebarFooter from "./SidebarFooter.vue";
import { sidebarHoverPreviewData, sidebarHoverPreviewComputed, sidebarHoverPreviewMethods } from "./helpers/sidebarHoverPreview.js";
import { getFavoriteElements, parseFavoriteIds, SIDEBAR_FAVORITES_SETTING, toggleFavoriteId } from "./helpers/sidebarFavorites.js";
import { resolveNavigationGroup } from "./helpers/navElement.js";
import { resolveApiMessage } from "@/assets/utils";

export default {
  subscribeTable: ['nav_group', 'nav_element'],
  name: "SidebarNavigation",
  components: { Loading, SidebarGroupList, SidebarFavorites, SidebarPreview, SidebarFooter },

  props: {
    activeElement: {
      type: Object,
      default: null,
    },
  },

  data() {
    return {
      isCollapsed: false,

      // Stores open/closed state per subgroup, e.g.:
      // { Home: true, Study: false, ... }
      groupStates: {},
      favoriteIdsOverride: null,
      isSavingFavorites: false,

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
    settings() {
      return this.$store.getters["settings/getSettings"] || {};
    },
    favoriteIds() {
      return this.favoriteIdsOverride || parseFavoriteIds(this.settings[SIDEBAR_FAVORITES_SETTING]);
    },
    favoriteElements() {
      const availableElements = this.defaultGroupedElements.flatMap(group => group.elements);
      return getFavoriteElements(availableElements, this.favoriteIds);
    },
    activeElementId() {
      return this.activeElement?.id ?? null;
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
      return resolveNavigationGroup(this.defaultGroupedElements, this.activeElement);
    },

    // Hover-preview coordination (hoveredSubgroup), spread in from sidebarHoverPreview.js
    ...sidebarHoverPreviewComputed,
  },

  watch: {
    activeSubgroup(newGroup) {
      if (newGroup) {
        this.setOnlyExpandedGroup(newGroup);
      } else {
        this.closeAllGroups();
      }
    },
    defaultGroupedElements(newGroups) {
      newGroups.forEach(group => {
        if (!(group.key in this.groupStates)) {
          this.groupStates[group.key] = false;
        }
      });
      this.$nextTick(() => this.syncSidebarWithRoute());
      if (this.hoveredGroup) {
        if (!newGroups.some(group => group.key === this.hoveredGroup)) {
          this.resetPreview();
        } else {
          this.$nextTick(() => this.updatePreviewPosition());
        }
      }
    },
    $route() {
      this.resetPreview();

      this.$nextTick(() => {
        requestAnimationFrame(() => {
          this.syncSidebarWithRoute();
        });
      });
    },
  },

  mounted() {
    document.body.classList.add('sidebar-exists');
    this.eventBus.on("dashboardHome", this.syncSidebarWithRoute);
    window.addEventListener("resize", this.updatePreviewPosition);
    window.addEventListener("scroll", this.updatePreviewPosition, true);

    this.initGroupStates();
    this.syncSidebarWithRoute();
  },

  beforeUnmount() {
    this.eventBus.off("dashboardHome", this.syncSidebarWithRoute);
    window.removeEventListener("resize", this.updatePreviewPosition);
    window.removeEventListener("scroll", this.updatePreviewPosition, true);
    this.previewResizeObserver?.disconnect();
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

    // Opens only the subgroup containing the active dashboard and closes all others
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
    toggleFavorite(element) {
      if (this.isSavingFavorites || !element || element.id === undefined || element.id === null) {
        return;
      }

      const availableIds = new Set(
        this.defaultGroupedElements.flatMap(group => group.elements.map(item => String(item.id)))
      );
      if (!availableIds.has(String(element.id))) {
        return;
      }

      const nextFavoriteIds = toggleFavoriteId(this.favoriteIds, element.id);
      this.favoriteIdsOverride = nextFavoriteIds;
      this.isSavingFavorites = true;
      this.$socket.emit("appSettingSet", {
        key: SIDEBAR_FAVORITES_SETTING,
        value: JSON.stringify(nextFavoriteIds),
      }, result => {
        this.isSavingFavorites = false;
        this.favoriteIdsOverride = null;
        if (!result?.success) {
          this.eventBus.emit("toast", {
            title: this.$t("sidebar.favorites.saveFailedTitle"),
            message: resolveApiMessage(result, "sidebar.favorites.saveFailedMessage"),
            variant: "danger",
          });
        }
      });
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
      if (this.activeSubgroup) {
        this.setOnlyExpandedGroup(this.activeSubgroup);
      } else {
        this.closeAllGroups();
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

.sidebar-icon {
  height: 25px;
  width: 25px;
  flex-shrink: 0;
  margin-right: 12px;
  margin-left: -2px;
}

/* ========================================
   4. COLLAPSED SIDEBAR MODE (own markup only; SidebarGroup.vue,
      SidebarPreview.vue and SidebarFooter.vue own their collapsed-mode rules)
======================================== */

#sidebar-wrapper.collapsed .sidebar-icon {
  margin-right: 0;
  margin-left: 0;
}
</style>
