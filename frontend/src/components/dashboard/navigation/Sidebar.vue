<template>
  <Loading v-if="sidebarElements > 0 || sidebarGroups > 0 "/>
  <div v-else
    id="wrapper"
    class="nav-container"
  >
    <div id="sidebar-wrapper">
      <div class="list-group-test">
        <span>
          <div
            v-for="subgroup in defaultGroupedElements"
            :key="subgroup.key"
            class="default-subgroup"
          >
            <div
              class="sidebar-subgroup-heading list-group-item-custom p-3"
              @click="toggleGroup(subgroup.key)"
            >
              <div class="list-group-item-text subgroup-title">
                {{ subgroup.name }}
              </div>
              <span
                class="subgroup-arrow"
                :class="arrowAnimationClass[subgroup.key]"
              >
                <LoadIcon icon-name="chevron-down" />
              </span>
            </div>

            <transition
              name="submenu"
              @enter="enterSubmenu"
              @leave="leaveSubmenu"
            >
              <div
                v-if="expandedGroups[subgroup.key]"
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
                    :title="element.name"
                  >
                    <LoadIcon
                      :icon-name="element.icon"
                      :size="24"
                    />
                  </span>
                  <div class="list-group-item-text">{{ element.name }}</div>
                </router-link>
              </div>
            </transition>
          </div>
        </span>
      </div>
      <div v-if="isAdmin" class="text-center text-secondary">
          App Version: {{ version }}
        </div>
      <div
        class="collapse-sidebar-container list-group-item-action list-group-item list-group-item-custom"
        title="Toggle sidebar"
        @click="toggleSidebar()"
      >
        <span class="arrow-toggle sidebar-icon">
          <LoadIcon name="chevron-double-right" />
        </span>
        <div class="list-group-item-text" style="cursor:pointer">
          Collapse sidebar
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
 * @author Carly Gettinger, Dennis Zyska, Nils Dycke
 */
import LoadIcon from "@/basic/Icon.vue";
import Loading from "@/basic/Loading.vue";

export default {
  subscribeTable: ['nav_group', 'nav_element'],
  name: "SidebarNavigation",
  components: {LoadIcon, Loading},
  data() {
    return {
      version: APP_VERSION,
      sidebarSubgroupConfig: {
        Home: ["Home", "Documents"],
        Study: ["Studies", "Study Sessions", "Tags", "Submissions"],
        Manage: ["Projects", "Users", "User Statistics"],
        Settings: ["System Settings", "Logs", "Configurations"],
        AI: ["NLP Skills"],
      },
      arrowAnimationClass: {},
      expandedGroups: {},
    }
  },
  computed: {
    sidebarElements() {
      const groups = this.$store.getters['table/nav_element/getAll']
        .filter(element => {
          const hasRight = this.$store.getters["auth/checkRight"](`frontend.dashboard.${element.path}.view`);
          return (!element.admin || this.isAdmin) && hasRight;
        })
        .reduce((acc, cur) => {
                if (cur.groupId === 0 || cur.groupId === undefined) {
                    console.error("For navigation element " + cur.name + " the group id " + cur.group + " doesn't exists!");
                } else {
                    if (cur["groupId"] !== undefined) {
                        acc[cur["groupId"]] = acc[cur["groupId"]] || [];
                        acc[cur['groupId']].push(cur)
                    }
                }
                return acc
            }, [])

            return groups.map(e => e.sort(function (a, b) {
                return a["order"] - b["order"];
            }))
    },
    defaultGroupedElements() {
      return Object.entries(this.sidebarSubgroupConfig)
        .map(([groupName, elementNames]) => ({
          key: groupName,
          name: groupName,
          elements: elementNames
            .map(elementName =>
              this.allSidebarElementsForGrouping.find(
                element => element.name === elementName
              )
            )
            .filter(Boolean),
        }))
        .filter(group => group.elements.length > 0);
    },
    sidebarGroups() {
      const groups = this.$store.getters['table/nav_group/getAll'].filter(group => !group.admin || this.isAdmin);
      return groups.sort(function (a, b) {
        return a["order"] - b["order"];
      });
    },
    activeSubgroup() {
      const currentPath = this.$route.path.toLowerCase();

      const currentElement = this.$store.getters['table/nav_element/getAll']
        .find(element => currentPath === `/dashboard/${element.path}`.toLowerCase());

      if (!currentElement) {
        return null;
      }

      return Object.entries(this.sidebarSubgroupConfig).find(([, elementNames]) =>
        elementNames.some(
          elementName => elementName.toLowerCase() === currentElement.name.toLowerCase()
        )
      )?.[0] || null;
    },
    defaultElements() {
      const defaultGroup = this.sidebarGroups.find(group => group.name === "Default");
      return defaultGroup ? (this.sidebarElements[defaultGroup.id] || []) : [];
    },

    adminElements() {
      const adminGroup = this.sidebarGroups.find(group => group.name === "Admin");
      return this.isAdmin && adminGroup ? (this.sidebarElements[adminGroup.id] || []) : [];
    },

    allSidebarElementsForGrouping() {
      return [...this.defaultElements, ...this.adminElements];
    },
    isAdmin() {
      return this.$store.getters['auth/isAdmin'];
    }
  },
  mounted() {
    document.body.classList.add('sidebar-exists');

    const subgroupNames = Object.keys(this.sidebarSubgroupConfig);

    subgroupNames.forEach(name => {
      this.expandedGroups[name] = false;
      this.arrowAnimationClass[name] = '';
    });

    this.syncSidebarWithRoute();
  },
  beforeUnmount() {
    document.body.classList.remove('sidebar-exists');
  },
  methods: {
    toggleSidebar() {
      document.body.classList.toggle('sb-sidenav-toggled');
    },

    closeAllGroups() {
      Object.keys(this.expandedGroups).forEach(groupName => {
        this.expandedGroups[groupName] = false;
        this.arrowAnimationClass[groupName] = 'arrow-close';
      });
    },

    setExpandedGroup(groupName) {
      if (groupName) {
        this.expandedGroups[groupName] = true;
        this.arrowAnimationClass[groupName] = 'arrow-open';
      }
    },

    syncSidebarWithRoute() {
      const currentPath = this.$route.path.toLowerCase().replace(/\/$/, '');

      if (currentPath === '/dashboard') {
        return;
      }

      if (this.activeSubgroup) {
        this.setExpandedGroup(this.activeSubgroup);
      }
    },

    toggleGroup(groupName) {
      const isOpening = !this.expandedGroups[groupName];

      this.expandedGroups[groupName] = isOpening;
      this.arrowAnimationClass[groupName] = isOpening
        ? 'arrow-open'
        : 'arrow-close';
    },

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
  watch: {
    $route(to) {
      const toPath = to.path.toLowerCase().replace(/\/$/, '');

      if (toPath === '/dashboard') {
        this.$nextTick(() => {
          requestAnimationFrame(() => {
            this.closeAllGroups();
          });
        });
        return;
      }

      this.syncSidebarWithRoute();
    },

    activeSubgroup: {
      immediate: true,
      handler(newGroup) {
        const currentPath = this.$route.path.toLowerCase().replace(/\/$/, '');

        if (currentPath === '/dashboard') {
          return;
        }

        if (newGroup) {
          this.setExpandedGroup(newGroup);
        }
      },
    },
  },
}

</script>

<style>

#wrapper {
  height: 100%;
  background-color: #f2f2f2;
}

#sidebar-wrapper {
  -webkit-transition: width .25s ease-out;
  -moz-transition: width .25s ease-out;
  -o-transition: width .25s ease-out;
  transition: width .25s ease-out;
  transition-delay: 0.1s;
  overflow-y: scroll;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  width: 13rem;
}

#sidebar-wrapper::-webkit-scrollbar {
  display:none;
}

.collapse-sidebar-container {
  border-top: 1px solid rgba(0, 0, 0, 0.125);
}

body.sb-sidenav-toggled .list-group-item-text {
  display: none;
}

@media (min-width: 768px) {

  body.sb-sidenav-toggled #wrapper #sidebar-wrapper {
    width: 50px;
  }
}

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

.arrow-toggle {
  transform: rotate(180deg);
}

body.sb-sidenav-toggled .arrow-toggle {
  transform: rotate(0deg);
}

.sidebar-subgroup-heading {
  display: flex !important;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  font-weight: 600;
  border: none;
  background-color: #f2f2f2;
}

.sidebar-subgroup-heading:hover {
  background-color: white !important;
}

.subgroup-title {
  font-weight: 600;
}

.subgroup-arrow {
  display: flex;
  align-items: center;
  transform-origin: center;
}

.arrow-open {
  animation: flip-horizontal-bottom 0.25s ease both;
}

.arrow-close {
  animation: flip-horizontal-top 0.25s ease both;
}

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

.default-subitem {
  padding-left: 2.0rem !important;
}

.default-subitem.router-link-active,
.default-subitem.router-link-exact-active {
  background-color: #e0e0e0 !important;
  box-shadow: inset 2px 0 0 #222;
}

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

</style>
