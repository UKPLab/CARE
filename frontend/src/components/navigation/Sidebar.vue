<template>
  <div id="wrapper" class="nav-container">
    <div id="sidebar-wrapper">
      <div class="list-group-test">
        <span v-for="group in sidebarGroups">
          <h5 class="mb-1 sidebar-heading">{{ group.name }}</h5>
          <router-link :to="'/dashboard/' + element.path" v-for="element in sidebarElements[group.id]"
                       class="list-group-item list-group-item-action p-3">
            <span class="sidebar-icon" :title="element.name">
              <LoadIcon :iconName="element.icon" :size="24"/>
            </span>
          <div class="list-group-item-text">{{ element.name }}</div>
          </router-link>

        </span>
      </div>

      <div class="collapse-sidebar-container list-group-item-action list-group-item"
           @click="toggleSidebar()" title="Toggle sidebar">
        <span class="arrow-toggle sidebar-icon">
<svg fill="currentColor" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path class="cls-1"
                                                                                      d="M16.88,15.53,7,5.66A1,1,0,0,0,5.59,7.07l9.06,9.06-8.8,8.8a1,1,0,0,0,0,1.41h0a1,1,0,0,0,1.42,0l9.61-9.61A.85.85,0,0,0,16.88,15.53Z"/><path
    class="cls-1"
    d="M26.46,15.53,16.58,5.66a1,1,0,0,0-1.41,1.41l9.06,9.06-8.8,8.8a1,1,0,0,0,0,1.41h0a1,1,0,0,0,1.41,0l9.62-9.61A.85.85,0,0,0,26.46,15.53Z"/></svg>
        </span>
        <div class="list-group-item-text">Collapse sidebar</div>
      </div>
    </div>
  </div>
</template>

<script>
/* Sidebar.vue - topbar and side toolbar  

This component provides both a topbar and left toggleable side toolbar.

Author: Carly Gettinger (cjgettinger@gmail.com)
Co-Author: Dennis Zyska (zyska@ukp...)
Source: left toggleable toolbar - adapted simple sidebar found at https://github.com/StartBootstrap/startbootstrap-simple-sidebar
*/

import LoadIcon from "../../icons/LoadIcon.vue";

export default {
  name: "Sidebar",
  components: {LoadIcon},
  computed: {
    sidebarElements() {
      return this.$store.getters['navigation/getSidebarElements'];
    },
    sidebarGroups() {
      return this.$store.getters['navigation/getSidebarGroups'];
    }
  },
  methods: {
    toggleSidebar() {
      document.body.classList.toggle('sb-sidenav-toggled');
    },


  },
  mounted() {
    document.body.classList.add('sidebar-exists');
  },
  beforeUnmount() {
    document.body.classList.remove('sidebar-exists');
  }
}

</script>

<style>

#wrapper {
  height: 100%;
  background-color: #e7eeff;
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
  background-color: #e7eeff;
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
