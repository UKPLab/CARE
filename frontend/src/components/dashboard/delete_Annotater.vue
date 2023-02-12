<template>
    <PDFJSViewer :pdf_path="pdf_path"></PDFJSViewer>
</template>

<script>
/* Annotator.vue - annotation view

This parent component provides the annotation view, which
currently consists of the PDF viewer.

Author: Dennis Zyska (zyska@ukp...)
Source: -
*/
import PDFJSViewer from "./PDFJSViewer.vue";

export default {
  name: "Annotater",
  components: {PDFJSViewer},
  props: ['pdf_path'],
}
</script>

<style scoped>

</style>