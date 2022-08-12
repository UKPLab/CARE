<template>
  <div id="sidebar-container" class="collapse collapse-horizontal border-end d-flex flex-column vh-100"
       v-bind:class="showing">
    <div id="sidepane">
      <div id="spacer"></div>
      <ul id="anno-list" class="list-group">
        <li v-if="annotations.length === 0">
          <p class="text-center"> No annotations </p>
        </li>
        <li v-for="anno in annotations" v-bind:id="'anno-' + anno.id"
            :key="anno.id"
            :ref="anno.id"
            class="list-group-i"
            v-on:mouseleave="unhover(anno.id)"
            v-on:mouseover='hover(anno.id)'>
          <Annotation v-bind:id="anno.id" :annoData="anno" :config="config" :readonly="readonly"
                      @focus="focusAnnotation"></Annotation>
        </li>
        <li id="addPageNote" v-if="!readonly">
          <button type="button" class="btn btn-light" @click="createDocumentComment">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-plus-lg" viewBox="0 0 16 16">
              <path fill-rule="evenodd" d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2Z"></path>
            </svg>
            Document Note
          </button>
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
import {mapGetters, mapMutations} from "vuex";
import Annotation from "./Annotation.vue";
import {scrollElement} from "../../../../assets/anchoring/scroll";
import {v4} from "uuid";

export default {
  name: "Sidebar",
  components: {Annotation},
  props: {
    document_id: {
      type: String,
      required: true
    },
    readonly: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  data: function () {
    return {
      config: null,
    }
  },
  computed: {
    sidebarShowing() {
      return this.$store.getters['anno/isSidebarShowing']
    },
    annotations() {
      return this.$store.getters['anno/getAnnotations'](this.document_id).sort((a, b) => {
        const a_noanchor = a.anchors === null || a.anchors.length === 0;
        const b_noanchor = b.anchors === null || b.anchors.length === 0;

        if(a_noanchor || b_noanchor){
          return a_noanchor === b_noanchor ? 0 : (a_noanchor ? -1 : 1);
        }

        return (a.anchors[0].target.selector[0].start - b.anchors[0].target.selector[0].start);
      });
    },
    showing: function () {
      return this.sidebarShowing ? "show" : "collapsing"
    }
  },
  mounted() {
    this.eventBus.on('sidebarScroll', (anno_id) => {
      this.sidebarScrollTo(anno_id);
      this.$socket.emit("stats", {action: "sidebarScroll", data: {document_id: this.document_id, anno_id: anno_id}});
    })
    this.load();
  },
  methods: {
    ...mapMutations({
      toggleSidebar: "anno/TOGGLE_SIDEBAR",
      hover: "anno/HOVER",
      unhover: "anno/UNHOVER"
    }),
    ...mapGetters({userData: 'auth/getUser'}),
    load() {
      this.$socket.emit("loadAnnotations", {id: this.document_id});
    },
    async sidebarScrollTo(annotationId) {
      const scrollContainer = document.getElementById('sidebarContainer');
      await scrollElement(scrollContainer, document.getElementById('anno-' + annotationId).offsetTop - 52.5);
    },
    focusAnnotation(annotation_id) {
      this.$refs[annotation_id][0].scrollIntoView();
    },
    createDocumentComment(){
      const uid = this.userData().id;
      this.$socket.emit('addAnnotation',
          {
            "document_id": this.document_id,
            "annotation": {},
            "user": uid,
            "comment": null,
            "draft": true,
            "annotation_id": v4(),
            "tags": []
          });
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

#anno-list {
  list-style-type:none
}

#addPageNote {
  padding-top: 1rem;
  text-align: center;
}
#addPageNote .btn {
  border: none;
  color: #575757;
}
</style>