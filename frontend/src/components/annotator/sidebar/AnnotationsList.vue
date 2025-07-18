<template>
  <ul v-if="showAnnotations" id="anno-list" class="list-group">
    <li v-if="documentComments.length === 0">
      <p class="text-center">No elements</p>
    </li>
    <li
      v-for="comment in documentComments"
      :id="'comment-' + comment.id"
      :key="'documentComment-' + comment.id"
      class="list-group-i"
      @mouseleave="unhover(comment.annotationId)"
      @mouseover="hover(comment.annotationId)"
    >
      <AnnoCard
        :id="comment.id"
        :ref="'annocard' + comment.id"
        :comment-id="comment.id"
        @focus="sidebarScrollTo"
      />
    </li>

    <li v-if="!readOnly" id="addPageNote">
      <button
        class="btn btn-light"
        type="button"
        @click="createDocumentComment"
      >
        <svg
          class="bi bi-plus-lg"
          fill="currentColor"
          height="16"
          viewBox="0 0 16 16"
          width="16"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2Z"
            fill-rule="evenodd"
          />
        </svg>
        Document Note
      </button>
    </li>
  </ul>
</template>

<script>
import AnnoCard from "./card/AnnoCard.vue";

export default {
  name: "AnnotationsList",
  components: { AnnoCard },
  inject: ['studySessionId', 'acceptStats'],
  props: {
    showAnnotations: {
      type: Boolean,
      required: true
    },
    readOnly: {
      type: Boolean,
      default: false
    },
    documentComments: {
      type: Array,
      required: true
    }
  },
  emits: ['create-document-comment', 'scroll-to-comment'],
  methods: {
    hover(annotationId) {
      if (annotationId) {
        const annotation = this.$store.getters['table/annotation/get'](annotationId);
        if (annotation && "anchors" in annotation && annotation.anchors != null) {
          annotation.anchors
            .filter(anchor => "highlights" in anchor)
            .forEach(anchor => anchor.highlights.map((highlight) => {
              if ("svgHighlight" in highlight) {
                highlight.svgHighlight.classList.add("is-focused");
              }
              highlight.classList.add("highlight-focus");
            }))
        }
      }
    },
    unhover(annotationId) {
      if (annotationId) {
        const annotation = this.$store.getters['table/annotation/get'](annotationId);
        if (annotation && "anchors" in annotation && annotation.anchors != null) {
          annotation.anchors
            .filter(anchor => "highlights" in anchor)
            .forEach(anchor => anchor.highlights.map((highlight) => {
              if ("svgHighlight" in highlight) {
                highlight.svgHighlight.classList.remove("is-focused");
              }
              highlight.classList.remove("highlight-focus");
            }))
        }
      }
    },
    async sidebarScrollTo(commentId) {
      // Emit the scroll event to parent component which has access to sidepane ref
      this.$emit('scroll-to-comment', commentId);
    },
    createDocumentComment() {
      this.$emit('create-document-comment');
    }
  }
};
</script>

<style scoped>
#anno-list .list-group-i {
  border: none;
  background-color: transparent;
  margin-top: 4px;
  margin-left: 2px;
  margin-right: 2px;
}

#anno-list {
  list-style-type: none;
  flex: 1;
  overflow-y: auto;
  padding: 0;
  margin: 0;
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