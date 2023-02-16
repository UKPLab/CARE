<template>
  <a v-if="comment">{{ comment.text }}</a>
  <a v-else id="emptyText">(no text)</a>
  <button
          id="cite"
          :title="citationText"
          class="btn btn-link btn-sm"
          data-placement="top"
          data-toggle="tooltip"
          @click="showAnno()">(ref. {{ citation }})
  </button>
</template>

<script>
export default {
  name: "ReportItem",
  props: {
    annotationId: {
      required: true
    }
  },
  emits: ["showReportAnnotation"],
  computed: {
    comment() {
      return this.$store.getters["comment/getCommentByAnnotation"](this.annotationId);
    },
    annotation() {
      return this.$store.getters["anno/getAnnotation"](this.annotationId);
    },
    citation() {
      if (this.annotation) {
        return this.annotation.selectors.target[0].selector[0].start;
      }
    },
    citationText() {
      if (this.annotation) {
        return this.annotation.selectors.target[0].selector[1].exact;
      }
    }
  },
  methods: {
    showAnno() {
      this.$emit("showReportAnnotation", this.annotationId);
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