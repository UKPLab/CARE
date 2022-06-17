<template>
  <div class="container-fluid">
    <div class="row flex-nowrap">
      <main class="col ps-md-2 pt-2">
        <button type="button" class="btn btn-outline-secondary" @click="toggleSidebar()" data-toggle="tooltip" data-placement="top" title="Open/close sidebar...">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-caret-right-square" viewBox="0 0 16 16">
            <path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/>
            <path d="M5.795 12.456A.5.5 0 0 1 5.5 12V4a.5.5 0 0 1 .832-.374l4.5 4a.5.5 0 0 1 0 .748l-4.5 4a.5.5 0 0 1-.537.082z"/>
          </svg>
          <span class="visually-hidden">Sidebar</span>
        </button>
        <PDFViewer :document_id="pdf_path"></PDFViewer>
        <Adder :document_id="pdf_path"></Adder>
      </main>
      <div class="col-auto px-0">
        <Sidebar :document_id="pdf_path" />
      </div>
    </div>
  </div>

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

</style>