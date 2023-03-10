<template>
  <div
    id="wrapper"
    class="nav-container"
  >
    <div id="sidebar-wrapper">
      <div class="list-group-test">
        <span v-for="group in sidebarGroups">
          <div
            v-if="group.name !== 'Default'"
            class="sidebar-heading"
          >
            <h5 class="mb-1">{{ group.name }}</h5>
          </div>
          <router-link
            v-for="element in sidebarElements[group.id]"
            :to="'/dashboard/' + element.path"
            class="list-group-item list-group-item-action p-3"
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
        </span>
      </div>

      <div
        class="collapse-sidebar-container list-group-item-action list-group-item"
        title="Toggle sidebar"
        @click="toggleSidebar()"
      >
        <span class="arrow-toggle sidebar-icon">
          <LoadIcon name="chevron-double-right" />
        </span>
        <div class="list-group-item-text">
          Collapse sidebar
        </div>
      </div>
    </div>
  </div>
</template>

<script>
/* Sidebar.vue - topbar and side toolbar  

This component provides both a topbar and left toggleable side toolbar.

Author: Carly Gettinger
Co-Author: Dennis Zyska, Nils Dycke

Source: left toggleable toolbar - adapted simple sidebar found at https://github.com/StartBootstrap/startbootstrap-simple-sidebar
*/

import LoadIcon from "@/icons/LoadIcon.vue";

export default {
  name: "Sidebar",
  components: {LoadIcon},
  computed: {
    sidebarElements() {
      return this.$store.getters['navigation/getSidebarElements'];
    },
    sidebarGroups() {
      return this.$store.getters['navigation/getSidebarGroups'].filter(group => !group.admin || this.isAdmin);
    },
    isAdmin() {
      return this.$store.getters['auth/isAdmin'];
    }
  },
  mounted() {
    document.body.classList.add('sidebar-exists');
  },
  beforeUnmount() {
    document.body.classList.remove('sidebar-exists');
  },
  methods: {
    toggleSidebar() {
      document.body.classList.toggle('sb-sidenav-toggled');
    },
  }
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

  body.sb-sidenav-toggled .sidebar-heading {
    display: none;
  }
}

.list-group-item {
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

.sidebar-heading {
  padding-left: 12px;
  margin-top: 10px;
  padding-bottom: 10px;
  border-bottom: 1.5px solid rgba(0, 0, 0, 0.125);
}


.arrow-toggle {
  transform: rotate(180deg);
}

body.sb-sidenav-toggled .arrow-toggle {
  transform: rotate(0deg);
}


</style>
