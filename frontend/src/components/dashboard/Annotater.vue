<template>
    <PDFJSViewer :pdf_path="pdf_path"></PDFJSViewer>
</template>

<script>
import PDFJSViewer from "./PDFJSViewer.vue";

export default {
  name: "Annotater",
  components: {PDFJSViewer},
  props: ['pdf_path'],
}
</script>

<style scoped>

</style>