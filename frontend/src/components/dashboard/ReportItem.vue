<template>
  <a v-if="content.comment !== null">{{content.comment.text}}</a>
  <a v-else id="emptyText">(no text)</a>
  <button class="btn btn-link btn-sm" @click="showAnno()" id="cite" v-if="!isPageNote">(ref. {{citation}})</button>
</template>

<script>
export default {
  name: "ReportItem",
  props: {
     content: {
       required: true
     }
  },
  emits: ["showReportAnnotation"],
  computed: {
    isPageNote(){
      return this.content.anchors === null;
    },
    citation(){
      if(!this.isPageNote){
        return this.content.annotationData.target[0].selector[0].start;
      } else {
        return null;
      }
    }
  },
  methods: {
    showAnno(){
      this.$emit("showReportAnnotation", this.content.id);
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