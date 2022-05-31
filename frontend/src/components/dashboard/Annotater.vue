<template>
    <PDFJSViewer :pdf_path="pdf_path"></PDFJSViewer>
</template>

<script>
import PDFJSViewer from "./PDFJSViewer.vue";

export default {
  name: "Annotater",
  components: {PDFJSViewer},
  props: ['pdf_path'],
  mounted() {

    const clientConfig = {
      sidebarAppUrl: '/app.html',
      notebookAppUrl: '/notebook.html',
      openSidebar: true,
      assetRoot: "/hypothesis/",
    };

    const configScript = document.createElement("script");
    configScript.type = 'application/json';
    configScript.className = 'js-hypothesis-config';
    configScript.textContent = JSON.stringify(clientConfig);
    document.head.appendChild(configScript);

  }
}
</script>

<style scoped>

</style>