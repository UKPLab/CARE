<template>
  <div id="sidebar-container" class="collapse collapse-horizontal border-end d-flex flex-column vh-100" v-bind:class="showing">
    <TopBar id="topbar"></TopBar>
    <div id="sidepane">
        <div v-if="annotations.length === 0" class="list-group border-0 rounded-0 text-sm-start">
              No annotations present...
        </div>
        <div v-else id="anno-list" class="list-group border-0 rounded-0 text-sm-start">
          <a v-for="anno in annotations" class="list-group-item border-end-0 d-inline-block" data-bs-parent="#sidebar">
            <span>{{anno.comment}}</span></a>
        </div>
      </div>
  </div>
</template>

<script>
import {mapMutations} from "vuex";
import TopBar from "./TopBar.vue"

export default {
  name: "Sidebar",
  components: {TopBar},
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
    ...mapMutations({toggleSidebar: "anno/TOGGLE_SIDEBAR"}),
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