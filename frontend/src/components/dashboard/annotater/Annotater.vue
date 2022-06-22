<template>
  <b-container fluid id="annotator">
    <b-row flex-nowrap align-v="stretch">
      <b-col id="docview">
        <PDFViewer :document_id="pdf_path"></PDFViewer>
        <Adder :document_id="pdf_path"></Adder>
      </b-col>
      <b-col id="sidebar" cols="sm-auto">
        <Sidebar :document_id="pdf_path" />
      </b-col>
    </b-row>
  </b-container>

</template>

<script>
/* Annotator.vue - annotation view

This parent component provides the annotation view, which
currently consists of the PDF viewer.

Author: Dennis Zyska (zyska@ukp...)
Source: -
*/
import PDFViewer from "./PDFViewer.vue";
import Adder from "./Adder.vue";
import Sidebar from "./sidebar/Sidebar.vue";
export default {
  name: "Annotater",
  components: {Adder, PDFViewer, Sidebar},
  props: ['pdf_path'],
  data() {
    return {
    }
  },
}
</script>

<style scoped>
#annotator {
  height:100vh;
}
#docview {
  height:100vh;
}
#sidebar {
  height:100vh;
  padding: 0;
  max-width: 300px;
}
</style>