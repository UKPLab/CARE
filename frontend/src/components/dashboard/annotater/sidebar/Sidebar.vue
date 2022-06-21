<template>
  <b-container fluid id="sidebar-container">
    <b-row>
      <b-col id="collapsable" cols="sm-auto" offset="0">
        <button @click="toggleSidebar()" type="button" class="btn btn-outline-secondary"  data-toggle="tooltip" data-placement="top" title="Open/close sidebar...">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-caret-right-square" viewBox="0 0 16 16">
          <path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/>
          <path d="M5.795 12.456A.5.5 0 0 1 5.5 12V4a.5.5 0 0 1 .832-.374l4.5 4a.5.5 0 0 1 0 .748l-4.5 4a.5.5 0 0 1-.537.082z"/>
        </svg>
        <span class="visually-hidden">Sidebar</span>
      </button>
      </b-col>
      <b-col id="annotations" offset="0" padding="0" class="collapse collapse-horizontal border-end"  v-bind:class="showing">
        <b-container style="height:100vh;padding:0px">
          <b-row id="top-row">
            <TopBar></TopBar>
          </b-row>
          <b-row id="pane-row">
            <div id="sidepane">
              <div v-if="annotations.length === 0" class="list-group border-0 rounded-0 text-sm-start min-vh-100">
                    No annotations present...
              </div>
              <div v-else id="anno-list" class="list-group border-0 rounded-0 text-sm-start min-vh-100">
                <a v-for="anno in annotations" class="list-group-item border-end-0 d-inline-block" data-bs-parent="#sidebar">
                  <span>{{anno.comment}}</span></a>
              </div>
            </div>
          </b-row>
        </b-container>
        </b-col>
      </b-row>
  </b-container>
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
  height:100vh;
}
#sidepane {
  background-color: #bfbfbf;
  height:100%;
  overflow:scroll;
}
#top-row {
  height: 10%;
}
#pane-row {
  height: 90%;
}
#collapsable {
  padding-left: 0;
  padding-right: 0;
  max-width:10%;
}
#annotations {
  padding: 0;
  max-width:90%;
  height:100px;
}
</style>