<template>
  <div>
    <PDFPage
      v-for="page in pdf.pages"
      v-bind="{scale, scrollTop, clientHeight}"
      :key="page.pageNumber"
      :pageNumber="page.pageNumber"
      class="scrolling-page"
      :pdf="pdf"
      @page-rendered="onPageRendered"
      @page-errored="onPageErrored"
    />
  </div>
</template>

<script>
/* PDFJSViewer.vue - PDF Viewer are rendered by PDF.js

This component provides the PDF in a classical PDF viewer
as rendered by PDF.js.

Author: Dennis Zyska (zyska@ukp...)
Source: https://rossta.net/blog/building-a-pdf-viewer-with-vue-part-1.html
https://github.com/rossta/vue-pdfjs-demo/blob/master/src/components/PDFDocument.vue
*/

import PDFPage from "./PDFPage.vue";

import scroll from "../../../../assets/pdf/scroll";
import visible from "../../../../assets/pdf/visible";

import { PDF } from './pdfStore.js';
import * as pdfjsLib  from "pdfjs-dist/build/pdf.js"
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.entry";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
//pdfjsLib.disableWorker = true;
export default {
  name: "PDFViewer",
  components: {PDFPage},
  props: {
    document_id: {
      type: String,
      required: true
    },
    scale: {
      type: Number,
      default: 1.0,
    },
  },
  directives: {
    visible, scroll
  },
  data() {
    return {
      pdf: new PDF(),
      scrollTop: 0,
      clientHeight: 0,
      focusedPage: undefined,
    }
  },
  watch: {
    "pdf.pageCount" () {
      this.pdf.fetchPages();
    },
    pagesLength(count, oldCount) {
      this.$nextTick(() => {
        this.focusedPage = this.currentPage;
      });
    },
    currentPage(currentPage) {
      if (currentPage > this.pages.length) {
        this.fetchPages(currentPage);
      } else {
        this.focusedPage = currentPage;
      }
    }
  },
  computed: {
    pagesLength() {
      return this.pdf.pages.length;
    }
  },
  sockets: {
    pdf: function (data) {
      const loadingTask = pdfjsLib.getDocument(data.file);
      loadingTask.promise
          .then((pdf) => {
            this.pdf.setPDF(pdf);
          })
          .catch(response => {
            console.log(response);
            this.$router.push("/index.html");
          });
    }
  },
  mounted() {
    this.$socket.emit("pdf_get", {document_id: this.document_id});
  },
  methods: {
    onPageJump(scrollTop) {
      console.log(scrollTop);
      this.$emit('page-jump', scrollTop);
    },
    fetchPages(currentPage) {
      this.pdf.fetchPages(currentPage);
    },
    updateScrollBounds() {
      const {scrollTop, clientHeight} = this.$el;
      this.scrollTop = scrollTop;
      this.clientHeight = clientHeight;
      console.log("scrollTop:" + scrollTop);
      console.log("clientheight: " + clientHeight);
    }
  },
   /*  this.pdf = pdf;



        let viewer = document.getElementById('pdf-viewer');

        const render = (thePdf, pageNumber, canvas) => {
        thePdf.getPage(pageNumber).then(function(page) {
          let viewport = page.getViewport({ scale: 1 });
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          page.render({canvasContext: canvas.getContext('2d'), viewport: viewport});
        });}

        for(let page = 1; page <= pdf.numPages; page++) {
          let canvas = document.createElement("canvas");
          canvas.className = 'pdf-page-canvas';
          viewer.appendChild(canvas);
          render(pdf, page, canvas);
        }
        console.log(pdf);
      });*/



    //const loader = pdfjs.getDocument()
/*
    const loadViewer = setInterval(function () {
      if (window["pdfjs-dist/build/pdf"]) {
        clearTimeout(loadViewer);
        const pdfjs_viewer = document.createElement("script");
        pdfjs_viewer.setAttribute("src", "/pdfjs-dist/web/viewer.js");
        pdfjs_viewer.setAttribute("id", "script_pdfjs_viewer");
        document.head.appendChild(pdfjs_viewer);
      }}, 50);

    // Listen for `webviewerloaded` event to configure the viewer after its files
    // have been loaded but before it is initialized.
    document.addEventListener('webviewerloaded', () => {

      const appOptions = window.PDFViewerApplicationOptions;
      const app = window.PDFViewerApplication;

      appOptions.set('workerSrc', "/pdfjs-dist/build/pdf.worker.js")

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
          url: "/pdf/" + this.document_id,

          // Make sure `PDFViewerApplication.url` returns the original URL, as this
          // is the URL associated with annotations.
          originalUrl: document.URL,


        }).then(() => {

          app.pdfViewer.viewer.classList.add('has-transparent-text-layer');
          this.pdfContainer = app.appConfig?.appContainer ?? document.body;
          this.pdfViewer = app.pdfViewer;

          this.observer = new MutationObserver(debounce(() => this._update(), 100));
          this.observer.observe(this.pdfViewer.viewer, {
            attributes: true,
            attributeFilter: ['data-loaded'],
            childList: true,
            subtree: true,
          });

          //document.addEventListener('selectionchange', this._updateAnnotationLayerVisibility)

        });
      });
    }); */

}
</script>

<style scoped>
@media print {
  .pdf-document {
    position: static;
  }
}
</style>