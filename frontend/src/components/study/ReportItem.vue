<template>
  <a v-if="comment">{{ comment.text }}</a>
  <a
    v-else
    id="emptyText"
  >
    (no text)
  </a>
  <button
    id="cite"
    :title="citationText"
    class="btn btn-link btn-sm"
    data-placement="top"
    data-toggle="tooltip"
    @click="show()"
  >
    {{ citation ? `(ref. ${citation})` : "(show)" }}
  </button>
</template>

<script>

/* ReportItem.vue - item of a ReviewReport

A report item is associated with a comment and an annotation, which are represented as plain text with
a pointer to the actual highlights in the document. Only used in the ReportModal.

Author: Nils Dycke
Source: -
*/
export default {
  name: "ReportItem",
  props: {
    annotationId: {
      required: false,
      type: Number,
      default: null
    },
    commentId: {
      required: false,
      type: Number,
      default: null
    }
  },
  emits: ["showReportAnnotation", "showReportComment"],
  computed: {
    comment() {
      if(this.annotationId)
        return this.$store.getters["table/comment/getByKey"]("annotationId", this.annotationId)
        .find(comm => comm.parentCommentId === null);
      else
        return this.$store.getters["table/comment/get"](this.commentId);
    },
    annotation() {
      if(this.annotationId)
        return this.$store.getters['table/annotation/get'](this.annotationId);
      else
        return null;
    },
    citation() {
      if (this.annotation) {
        return this.annotation.selectors.target[0].selector[0].start;
      } else {
        return null;
      }
    },
    citationText() {
      if (this.annotation) {
        return this.annotation.selectors.target[0].selector[1].exact;
      }
    }
  },
  methods: {
    show() {
      if(this.annotation)
        this.$emit("showReportAnnotation", this.annotationId);
      else
        this.$emit("showReportComment", this.commentId);
    }
  }
}
</script>

<style scoped>
#emptyText {
  font-style: italic;
  color: darkgrey;
}
</style>