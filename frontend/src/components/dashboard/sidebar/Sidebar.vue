<template>
  <div id="sidebar" v-bind:class="showing">
      <span v-if="annotations.length === 0">
            No annotations present...
      </span>
      <div v-else id="sidebar-nav" class="list-group border-0 rounded-0 text-sm-start min-vh-100">
        <a v-for="anno in annotations" class="list-group-item border-end-0 d-inline-block" data-bs-parent="#sidebar">
          <span>{{anno.comment}}</span></a>
      </div>
  </div>
</template>

<script>
import {mapGetters} from "vuex";

export default {
  name: "Sidebar",
  data: function() {
    return {
    }
  },
  computed: {
    sidebarShowing () { return this.$store.getters['anno/isSidebarShowing'] },
    annotations() { return this.$store.getters['anno/getAnnotations'](1) },

    showing: function() {
      return this.sidebarShowing ? "collapse collapse-horizontal show border-end" : "collapse collapse-horizontal collapsing border-end"
    }
  }
}
</script>

<style scoped>
#sidebar-nav {
    width: 200px;
    background-color: #bfbfbf;
}
</style>