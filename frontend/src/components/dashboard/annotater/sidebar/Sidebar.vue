<template>
  <div id="sidebar-container" class="collapse collapse-horizontal border-end d-flex flex-column vh-100" v-bind:class="showing">
    <div id="sidepane">
        <div v-if="annotations.length === 0">
          <p class="text-center"> No annotations </p>
        </div>
        <ul v-else id="anno-list" class="list-group">
          <li v-for="anno in annotations" class="list-group-i"
              :key="anno.id"
              v-bind:id="anno.id"
              v-on:mouseover='hover(anno.id)'
              v-on:mouseleave="unhover(anno.id)">
            <Annotation v-bind:id="anno.id" :annoData="anno" :config="config" :scrollTo="scrollTo"></Annotation>
          </li>
        </ul>
      </div>
  </div>
</template>

<script>
import {mapMutations} from "vuex";
import Annotation from "./Annotation.vue";

export default {
  name: "Sidebar",
  components: {Annotation},
  props: ['document_id', 'scrollTo', 'config'],
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
  mounted() {
    this.load();
  },
  methods: {
    ...mapMutations({
      toggleSidebar: "anno/TOGGLE_SIDEBAR",
      hover: "anno/HOVER",
      unhover: "anno/UNHOVER"
    }),
    load() {
      this.$socket.emit("loadAnnotations", { id: this.document_id });
    }
  }
}
</script>

<style scoped>
#sidebar-container {
  max-width:300px;
  height:100%;
}
#sidepane {
  padding-top:5px;
  background-color: #bfbfbf;
  width:100%;
  height:100%;
}
#anno-list .list-group-item {
  border: none;
  background-color:transparent;
}
</style>