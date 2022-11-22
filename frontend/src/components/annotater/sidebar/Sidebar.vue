<template>
  <div id="sidebar-container" class="collapse collapse-horizontal border-end d-flex flex-column"
       v-bind:class="showing">
    <div id="sidepane" ref="sidepane">
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
          <SideCard v-bind:id="anno.id" :annotation_id="anno.id" :readonly="readonly" :document_id="document_id"
                      @focus="focusAnnotation"></SideCard>
        </li>
        <li v-for="comment in documentComments" v-bind:id="'documentComment-' + comment.id"
            :key="comment.id"
            :ref="comment.id"
            class="list-group-i"
            v-on:mouseleave="unhover(comment.id)"
            v-on:mouseover='hover(comment.id)'>
          <DocumentCard v-bind:id="comment.id" :comment_id="comment.id" :readonly="readonly" :document_id="document_id"
                      @focus="focusAnnotation"></DocumentCard>
        </li>


        <li id="addPageNote" v-if="!readonly">
          <button type="button" class="btn btn-light" @click="createDocumentComment">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-plus-lg"
                 viewBox="0 0 16 16">
              <path fill-rule="evenodd"
                    d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2Z"></path>
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
import {mapMutations} from "vuex";
import AnnoCard from "./AnnoCard.vue";
import DocumentCard from "./DocumentCard.vue";
import {scrollElement} from "../../../assets/anchoring/scroll";


export default {
  name: "Sidebar",
  components: {AnnoCard, DocumentCard},
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
  computed: {
    sidebarShowing() {
      return this.$store.getters['anno/isSidebarShowing']
    },
    annotations() {
      return this.$store.getters['anno/getAnnotations'](this.document_id).sort((a, b) => {
        const a_noanchor = a.anchors === null || a.anchors.length === 0;
        const b_noanchor = b.anchors === null || b.anchors.length === 0;

        if (a_noanchor || b_noanchor) {
          return a_noanchor === b_noanchor ? 0 : (a_noanchor ? -1 : 1);
        }

        return (a.anchors[0].target.selector[0].start - b.anchors[0].target.selector[0].start);
      });
    },
    documentComments() {
      return this.$store.getters['comment/getDocumentComments'](this.document_id);
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
    load() {
      this.$socket.emit("loadAnnotations", {id: this.document_id});
      this.$socket.emit("loadCommentsByDocument", {id: this.document_id});
    },
    async sidebarScrollTo(annotationId) {
      const scrollContainer = this.$refs.sidepane;
      await scrollElement(scrollContainer, document.getElementById('anno-' + annotationId).offsetTop - 52.5);
    },
    async focusAnnotation(annotation_id) {
      //for now, just scroll to it
      await this.sidebarScrollTo(annotation_id);
    },
    createDocumentComment() {
      this.$socket.emit('addAnnotation', {
        document: this.document_id,
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
  overflow-y: scroll;
}

#anno-list .list-group-i {
  border: none;
  background-color: transparent;
  margin-top: 4px;
  margin-left: 2px;
  margin-right: 2px;
}

#anno-list {
  list-style-type: none
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