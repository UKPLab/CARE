<template>
  <a v-if="comment">{{ comment.text }}</a>
  <a v-else id="emptyText">(no text)</a>
  <button
          id="cite"
          :title="citationText"
          class="btn btn-link btn-sm"
          data-placement="top"
          data-toggle="tooltip"
          @click="show()">
    {{citation ? `(ref. ${citation})` : "(show)"}}
  </button>
</template>

<script>
export default {
  name: "ReportItem",
  props: {
    annotationId: {
      required: false,
      type: Number
    },
    commentId: {
      required: false,
      type: Number
    }
  },
  emits: ["showReportAnnotation"],
  computed: {
    comment() {
      if(this.annotationId)
        return this.$store.getters["comment/getCommentByAnnotation"](this.annotationId);
      else
        return this.$store.getters["comment/getComment"](this.commentId);
    },
    annotation() {
      if(this.annotationId)
        return this.$store.getters["anno/getAnnotation"](this.annotationId);
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