<template>
  <div id="sidebar-container" class="collapse collapse-horizontal border-end d-flex flex-column vh-100" v-bind:class="showing">
    <TopBar id="topbar" @closeSidebar="toggleSidebar"></TopBar>
    <div id="sidepane">
        <div v-if="annotations.length === 0">
          <p class="text-center"> No annotations </p>
        </div>
        <ul v-else id="anno-list" class="list-group">
          <li v-for="anno in annotations" class="list-group-item" v-bind:id="anno.id">
            <Annotation v-on:mouseover='hover(anno.id)' v-on:mouseleave="unhover(anno.id)" :annoData="anno"></Annotation>
          </li>
        </ul>
      </div>
  </div>
</template>

<script>
import {mapMutations} from "vuex";
import TopBar from "./TopBar.vue"
import Annotation from "./Annotation.vue";

export default {
  name: "Sidebar",
  components: {Annotation, TopBar},
  props: ['document_id'],
  data: function() {
    return {
    }
  },
  computed: {
    sidebarShowing () { return this.$store.getters['anno/isSidebarShowing'] },
    annotations() { return this.$store.getters['anno/getAnnotations'](this.document_id) },
    showing: function() {
      return this.sidebarShowing ? "show" : "collapsing"
    }
  },
  methods: {
    ...mapMutations({
      toggleSidebar: "anno/TOGGLE_SIDEBAR",
      hover: "anno/HOVER",
      unhover: "anno/UNHOVER"
    }),
  }
}
</script>

<style scoped>
#sidebar-container {
  max-width:300px;
  height:100%;
}
#topbar {
  width:300px;
}
#sidepane {
  padding-top:5px;
  background-color: #bfbfbf;
  overflow:scroll;
  width:100%;
  height:100%;
}
</style>