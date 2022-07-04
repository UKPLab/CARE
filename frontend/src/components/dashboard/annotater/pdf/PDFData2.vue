<script lang="ts">
/* Load PDF through websocket

This component provides the PDF loaded from websocket

Author: Dennis Zyska (zyska@ukp...)
Source: https://github.com/rossta/vue-pdfjs-demo/blob/master/src/components/PDFData.vue
*/

import { defineComponent, onMounted, reactive, ref } from 'vue';
import { VuePdf, createLoadingTask } from 'vue3-pdfjs/esm';
import { VuePdfPropsType } from 'vue3-pdfjs/components/vue-pdf/vue-pdf-props'; // Prop type definitions can also be imported
import { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import _ from 'lodash';


export default {
  name: "PDFData",
  props: {
    document_id: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      pages: [],
      cursor: 0,
      pdf: undefined,
      BUFFER_PAGES: 10,
    }
  },
  watch: {
    pdf() {
      this.fetchPages();
    },
  },
  computed: {
    pageCount() {
      return this.pdf ? this.pdf.numPages : 0;
    }
  },
  sockets: {
    pdf: function (data) {
      const loadingTask = createLoadingTask(data.file);
      loadingTask.promise
          .then((pdf: PDFDocumentProxy) => { this.pdf = pdf; console.log(typeof(pdf))})
          .catch(response => {
            //this.$socket.emit("error", response);
            this.$router.push("/index.html");
          });
    }
  },
  mounted() {
    this.$socket.emit("pdf_get", {document_id: this.document_id});
  },
  methods: {
    fetchPages(currentPage = 0) {
      if (!this.pdf) return;
      if (this.pageCount > 0 && this.pages.length === this.pageCount) return;

      const startIndex = this.pages.length;
      if (this.cursor > startIndex) return;

      const startPage = startIndex + 1;
      const endPage = Math.min(Math.max(currentPage, startIndex + this.BUFFER_PAGES), this.pageCount);
      this.cursor = endPage;

      this.getPages(this.pdf, startPage, endPage)
      .then((pages) => {
        const deleteCount = 0;
        this.pages.splice(startIndex, deleteCount, ...pages);
        return this.pages;
      }).catch((response) => {
        //this.$socket.emit("error", response);
      })
    },
    getPages(pdf, first, last) {
      console.log(_.range(first, last + 1));
      console.log(pdf.getPage(1));
      const allPages = _.range(first, last + 1).map(number => pdf.getPage(number));
      console.log(allPages);
      //return Promise.all(allPages);
    }
  }



}
</script>

<style scoped>

</style>