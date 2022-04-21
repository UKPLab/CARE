<template>

    <PDFJSViewer></PDFJSViewer>

</template>

<script>
import PDFJSViewer from "./PDFJSViewer.vue";

export default {
  name: "Annotater",
  components: {PDFJSViewer},
  props: ['pdf_path'],
  methods: {
    loadClient() {
      const src = `/hypothesis/`

      const scriptEl = document.createElement('script');
      scriptEl.src = src
      document.body.appendChild(scriptEl);
    }
  },
  created() {

    const scripts = [
      "/pdfjs/build/pdf.js",
      "/pdfjs/web/viewer.js"
    ];
    scripts.forEach(script => {
      let tag = document.createElement("script");
      tag.setAttribute("src", script);
      document.head.appendChild(tag);
    })
    console.log("Document URL:" + document.URL);
    console.log("PDF URL: " + "/pdf/" + this.pdf_path);

  },
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

    // Listen for `webviewerloaded` event to configure the viewer after its files
    // have been loaded but before it is initialized.
    document.addEventListener('webviewerloaded', () => {

      const appOptions = window.PDFViewerApplicationOptions;
      const app = window.PDFViewerApplication;

      appOptions.set('workerSrc', "/pdfjs/build/pdf.worker.js")

      // Ensure that PDF.js viewer events such as "documentloaded" are dispatched
      // to the DOM. The client relies on this.
      appOptions.set('eventBusDispatchToDOM', true);

      // Disable preferences support, as otherwise this will result in `eventBusDispatchToDOM`
      // being overridden with the default value of `false`.
      appOptions.set('disablePreferences', true);

      // Prevent loading of default viewer PDF.
      appOptions.set('defaultUrl', '');

      // Wait for the PDF viewer to be fully initialized and then load the Hypothesis client.
      //
      // This is required because the client currently assumes that `PDFViewerApplication`
      // is fully initialized when it loads. Note that "fully initialized" only means
      // that the PDF viewer application's components have been initialized. The
      // PDF itself will still be loading, and the client will wait for that to
      // complete before fetching annotations.
      //
      const pdfjsInitialized = new Promise(resolve => {
        // Poll `app.initialized` as there doesn't appear to be an event that
        // we can listen to.
        const timer = setInterval(function () {
          if (app.initialized) {
            clearTimeout(timer);
            resolve();
          }
        }, 20);
      });

      pdfjsInitialized.then(() => {
        // Load the PDF specified in the URL.
        //
        // This is done after the viewer components are initialized to avoid some
        // race conditions in `PDFViewerApplication` if the PDF finishes loading
        // (eg. from the HTTP cache) before the viewer is fully initialized.
        //
        // See https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions#can-i-specify-a-different-pdf-in-the-default-viewer
        // and https://github.com/mozilla/pdf.js/issues/10435#issuecomment-452706770
        app.open({
          // Load PDF through Via to work around CORS restrictions.
          url: "/pdf/" + this.pdf_path,

          // Make sure `PDFViewerApplication.url` returns the original URL, as this
          // is the URL associated with annotations.
          originalUrl: document.URL,
        });


        // Load hypothesis client
        this.loadClient();

      });
    });
  }
}
</script>

<style scoped>

</style>