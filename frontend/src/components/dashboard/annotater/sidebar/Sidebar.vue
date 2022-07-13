<template>
  <div id="sidebar-container" class="collapse collapse-horizontal border-end d-flex flex-column vh-100"
       v-bind:class="showing">
    <div id="sidepane">
      <div id="spacer"></div>
      <div v-if="annotations.length === 0">
        <p class="text-center"> No annotations </p>
      </div>
      <ul v-else id="anno-list" class="list-group">
        <li v-for="anno in annotations" v-bind:id="'anno-' + anno.id"
            :key="anno.id"
            :ref="anno.id"
            class="list-group-i"
            v-on:mouseleave="unhover(anno.id)"
            v-on:mouseover='hover(anno.id)'>
          <Annotation v-bind:id="anno.id" :annoData="anno" :config="config" :scrollTo="scrollTo"
                      @focus="focusAnnotation"></Annotation>
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
/* Sidebar.vue - sidebar component

Here the annotations are listed and can be modified, also includes scrolling feature.

Author: Nils Dycke (dycke@ukp...), Dennis Zyska (zyska@ukp...)
Source: -
*/
import {mapMutations} from "vuex";
import Annotation from "./Annotation.vue";
import {scrollElement} from "../../../../assets/anchoring/scroll";

export default {
  name: "Sidebar",
  components: {Annotation},
  props: ['document_id', 'scrollTo', 'config'],
  data: function () {
    return {}
  },
  computed: {
    sidebarShowing() {
      return this.$store.getters['anno/isSidebarShowing']
    },
    annotations() {
      return this.$store.getters['anno/getAnnotations'](this.document_id)
    },
    showing: function () {
      return this.sidebarShowing ? "show" : "collapsing"
    }
  },
  mounted() {
    this.eventBus.on('sidebarScroll', (anno_id) => {
      this.sidebarScrollTo(anno_id);
    })
    this.load();
  },
  methods: {
    ...mapMutations({
      toggleSidebar: "anno/TOGGLE_SIDEBAR",
      hover: "anno/HOVER",
      unhover: "anno/UNHOVER"
    }),
    load() {
      this.$socket.emit("loadAnnotations", {id: this.document_id});
    },
    async sidebarScrollTo(annotationId) {
      const scrollContainer = document.getElementById('sidebarContainer');
      await scrollElement(scrollContainer, document.getElementById('anno-' + annotationId).offsetTop - 52.5);
    },
    focusAnnotation(annotation_id) {
      this.$refs[annotation_id][0].scrollIntoView();
    }
  }
}
</script>

<style scoped>
#sidebar-container {
  max-width: 300px;
  height: 100%;
}

#spacer {
  width: 300px;
  background-color: transparent;
}

#sidepane {
  padding-top: 5px;
  background-color: #e6e6e6;
  width: 100%;
  height: 100%;
}

#anno-list .list-group-i {
  border: none;
  background-color: transparent;
  margin-top: 4px;
  margin-left: 2px;
  margin-right: 2px;
}
</style>