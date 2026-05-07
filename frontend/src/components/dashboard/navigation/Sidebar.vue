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
            <div
              v-for="subgroup in defaultGroupedElements"
              :key="subgroup.key"
              class="default-subgroup"
            >
              <!-- Subgroup header -->
              <div
                class="sidebar-subgroup-heading list-group-item-custom p-3"
                :class="{
                  'collapsed-group-icon-active': isCollapsed && activeSubgroup === subgroup.key,
                  'expanded-group-active': !isCollapsed && activeSubgroup === subgroup.key && !groupStates[subgroup.key],
                  'preview-group-active': hoveredGroup === subgroup.key && !groupStates[subgroup.key]
                }"
                :data-group-key="subgroup.key"
                @click="toggleGroup(subgroup.key)"
                @mouseenter="handleGroupMouseEnter($event, subgroup.key)"
                @mouseleave="handleGroupMouseLeave($event, subgroup.key)"
              >
                <!-- Expanded mode -->
                <div v-if="!isCollapsed" class="list-group-item-text subgroup-title">
                  <span class="sidebar-icon subgroup-heading-icon" :title="tNavGroup(subgroup)">
                    <LoadIcon :icon-name="subgroup.icon" :size="22" />
                  </span>
                  {{ tNavGroup(subgroup) }}
                </div>

                <!-- Expanded mode: subgroup arrow -->
                <span
                  v-if="!isCollapsed"
                  class="subgroup-arrow"
                  :class="arrowAnimationClass[subgroup.key]"
                >
                  <LoadIcon icon-name="chevron-down" />
                </span>

                <!-- Collapsed mode -->
                <span
                  v-else
                  class="sidebar-icon collapsed-group-icon"
                  :title="tNavGroup(subgroup)"
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
                  v-if="groupStates[subgroup.key] && !isCollapsed"
                  class="submenu-content"
                >
                  <router-link
                    v-for="element in subgroup.elements"
                    :key="element.id"
                    :to="'/dashboard/' + element.path"
                    class="list-group-item list-group-item-action list-group-item-custom p-3 default-subitem"
                  >
                    <span
                      class="sidebar-icon"
                      :title="tNavElement(element)"
                    >
                      <LoadIcon
                        :icon-name="element.icon"
                        :size="24"
                      />
                    </span>
                    <div class="list-group-item-text">{{ tNavElement(element) }}</div>
                  </router-link>
                </div>
              </transition>

              <!-- Hover preview -->
              <div
                v-if="hoveredGroup === subgroup.key && !groupStates[subgroup.key]"
                class="submenu-preview"
                :data-group-key="subgroup.key"
                :style="previewStyle"
                @mouseenter="handlePreviewMouseEnter"
                @mouseleave="handlePreviewMouseLeave($event, subgroup.key)"
              >
                <div class="submenu-preview-inner">
                  <!-- Collapsed mode: preview header -->
                  <div v-if="isCollapsed" class="submenu-preview-header">
                    {{ tNavGroup(subgroup) }}
                  </div>

                  <div v-if="isCollapsed" class="submenu-preview-divider" />

                  <router-link
                    v-for="element in subgroup.elements"
                    :key="`preview-${element.id}`"
                    :to="'/dashboard/' + element.path"
                    class="list-group-item list-group-item-action list-group-item-custom p-3 preview-subitem"
                  >
                    <span
                      class="sidebar-icon"
                      :title="tNavElement(element)"
                    >
                      <LoadIcon
                        :icon-name="element.icon"
                        :size="24"
                      />
                    </span>
                    <div class="list-group-item-text">{{ tNavElement(element) }}</div>
                  </router-link>
                </div>
              </div>
            </div>
          </span>
        </div>
      </div>

      <!-- Sidebar footer -->
      <div v-if="isAdmin && !isCollapsed" class="text-center text-secondary">
        App Version: {{ version }}
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

export default {
  subscribeTable: ['nav_group', 'nav_element'],
  name: "SidebarNavigation",
  components: { LoadIcon, Loading },

  data() {
    return {
      version: APP_VERSION,
      isCollapsed: false,

      // Stores open/closed state per subgroup, e.g.:
      // { Home: true, Study: false, ... }
      groupStates: {},

      // Hover preview state for collapsed sidebar / closed subgroup preview
      previewStyle: {},
      hoveredGroup: null,
      isHoveringPreview: false,
    };
  },

  computed: {
    /* ========================================
       Group state
    ======================================== */

    // Converts open/closed subgroup state into arrow animation classes
    arrowAnimationClass() {
      return Object.fromEntries(
        Object.entries(this.groupStates).map(([name, isOpen]) => [
          name,
          isOpen ? 'arrow-open' : 'arrow-close',
        ])
      );
    },

    activeSubgroup() {
      const currentPath = this.$route.path.toLowerCase();
      const currentElement = this.$store.getters['table/nav_element/getAll']
        .find(el => currentPath === `/dashboard/${el.path}`.toLowerCase());

      if (!currentElement) return null;

      const group = this.sidebarGroups.find(g => g.id === currentElement.groupId);

      return group?.name || null;
    },

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
       Preview state
    ======================================== */

    resetPreview() {
      this.hoveredGroup = null;
      this.previewStyle = {};
      this.isHoveringPreview = false;
    },

    // Checks whether the mouse moved into a related element of the same subgroup
    // Used to prevent flickering when moving the cursor from subgroup header
    // to preview and back
    _isRelatedTargetInGroup(event, groupName, selector) {
      return event.relatedTarget?.closest(selector)?.dataset.groupKey === groupName;
    },

    handleGroupMouseEnter(event, groupName) {
      if (this.groupStates[groupName]) {
        this.resetPreview();
        return;
      }

      const rect = event.currentTarget.getBoundingClientRect();

      this.previewStyle = {
        top: `${rect.top - 8}px`,
        left: `${rect.right}px`,
      };
      this.hoveredGroup = groupName;
    },

    handleGroupMouseLeave(event, groupName) {
      if (this._isRelatedTargetInGroup(event, groupName, '.submenu-preview')) return;
      this.resetPreview();
    },

    handlePreviewMouseEnter() {
      this.isHoveringPreview = true;
    },

    handlePreviewMouseLeave(event, groupName) {
      this.isHoveringPreview = false;

      if (this._isRelatedTargetInGroup(event, groupName, '.sidebar-subgroup-heading')) return;

      this.resetPreview();
    },

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

    tNavGroup(group) {
      const key = `sidebar.nav.groups.${group.name.toLowerCase()}`;
      const translated = this.$t(key);
      return translated === key ? group.name : translated;
    },

    tNavElement(element) {
      const key = `sidebar.nav.${element.path}`;
      const translated = this.$t(key);
      return translated === key ? element.name : translated;
    },
  },
};
</script>

<style>
/* ========================================
   1. ROOT LAYOUT
======================================== */

#wrapper {
  height: 100%;
  background-color: #f2f2f2;
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
   3. BASE ELEMENTS
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
  background-color: #f2f2f2;
}

.list-group-item:hover {
  background-color: white !important;
}

.sidebar-icon {
  height: 25px;
  width: 25px;
  flex-shrink: 0;
  margin-right: 12px;
  margin-left: -2px;
}

.subgroup-heading-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  vertical-align: middle;
}

/* ========================================
   4. SIDEBAR GROUPS
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
  background-color: #f2f2f2;
  border-radius: 0;
  padding-right: 2.75rem !important;
}

.sidebar-subgroup-heading:hover {
  background-color: white !important;
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

/* ========================================
   5. SUBMENU
======================================== */

.submenu-content {
  overflow: hidden;
}

.default-subitem {
  padding-left: 2.0rem !important;
}

.default-subitem.router-link-active,
.default-subitem.router-link-exact-active {
  background-color: #e0e0e0 !important;
  box-shadow: inset 2px 0 0 #222;
}

.submenu-enter-active,
.submenu-leave-active {
  transition:
    height 320ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 280ms ease,
    transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

/* ========================================
   6. SUBMENU PREVIEW
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
  background: #ebebeb;
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
  background: #f2f2f2;
  color: inherit;
}

.submenu-preview-divider {
  height: 1px;
  background: rgba(0, 0, 0, 0.08);
}

.preview-subitem {
  padding-left: 1rem !important;
}

.submenu-preview .preview-subitem {
  border-radius: 0 !important;
}

.submenu-preview .preview-subitem:first-child,
.submenu-preview .preview-subitem:last-child {
  border-radius: 0 !important;
}

.submenu-preview .list-group-item-custom {
  background-color: #f2f2f2 !important;
  color: inherit;
}

.submenu-preview .list-group-item-custom:hover {
  background-color: white !important;
}

.submenu-preview .preview-subitem.router-link-active,
.submenu-preview .preview-subitem.router-link-exact-active {
  background-color: #e0e0e0 !important;
  box-shadow: inset 2px 0 0 #222;
}

/* ========================================
   7. COLLAPSED SIDEBAR MODE
======================================== */

#sidebar-wrapper.collapsed > .sidebar-scroll-area .sidebar-subgroup-heading .list-group-item-text,
#sidebar-wrapper.collapsed > .collapse-sidebar-container .list-group-item-text,
#sidebar-wrapper.collapsed .subgroup-arrow,
#sidebar-wrapper.collapsed > .text-secondary {
  display: none !important;
}

#sidebar-wrapper.collapsed .submenu-preview .list-group-item-text {
  display: block !important;
}

#sidebar-wrapper.collapsed .submenu-preview .sidebar-icon {
  margin-right: 12px;
  margin-left: -2px;
}

#sidebar-wrapper.collapsed .sidebar-subgroup-heading,
#sidebar-wrapper.collapsed .collapse-sidebar-container {
  justify-content: center !important;
  padding-left: 0 !important;
  padding-right: 0 !important;
}

#sidebar-wrapper.collapsed .sidebar-icon {
  margin-right: 0;
  margin-left: 0;
}

#sidebar-wrapper.collapsed .sidebar-subgroup-heading {
  justify-content: center !important;
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
   8. ACTIVE / STATE STYLES
======================================== */

#sidebar-wrapper.collapsed .collapsed-group-icon-active {
  position: relative;
  background-color: #e0e0e0 !important;
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
  background-color: #e0e0e0 !important;
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
  background-color: white !important;
}

#sidebar-wrapper:not(.collapsed) .expanded-group-active.preview-group-active,
#sidebar-wrapper.collapsed .collapsed-group-icon-active.preview-group-active {
  background-color: white !important;
}

.arrow-toggle {
  transform: rotate(180deg);
}

body.sb-sidenav-toggled .arrow-toggle {
  transform: rotate(0deg);
}

.arrow-open {
  animation: flip-horizontal-bottom 0.25s ease both;
}

.arrow-close {
  animation: flip-horizontal-top 0.25s ease both;
}

/* ========================================
   9. ANIMATIONS
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

@keyframes preview-fade-in {
  from {
    opacity: 0;
    transform: translateX(-4px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
