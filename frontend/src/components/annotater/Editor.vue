<template>
  <Loader
    v-if="documentId && documentId === 0"
    :loading="true"
    class="pageLoader"
  />
  <span v-else>
    <div class="container-fluid d-flex min-vh-100 vh-100 flex-column">
      <div class="row d-flex flex-grow-1 overflow-hidden top-padding">
        <div
          id="viewerContainer"
          ref="viewer"
          class="col border mh-100 justify-content-center p-3"
          style="overflow-y: scroll;"
        >

  <QuillEditor ref="editor" v-model:content="content" theme="snow" @text-change="textChange"/>

        </div>
      </div>
    </div>
  </span>

  <Teleport to="#topBarNavItems">
    <button
        title="Download document"
        class="btn rounded-circle"
        type="button"
        @click="downloadDocument"
    >
      <LoadIcon
          :color="'#777777'"
          :size="18"
          icon-name="download"
      />
    </button>
  </Teleport>

</template>

<script>
/**
 * Editor component
 *
 * This component provides a Quill editor to edit the document.
 *
 * @author Zheyu Zhang
 */
import {Delta, QuillEditor} from "@vueup/vue-quill";
import "@vueup/vue-quill/dist/vue-quill.snow.css";
import debounce from "lodash.debounce";
import LoadIcon from "@/basic/Icon.vue";

export default {
  name: "EditorView",
  fetchData: ['document_edit'],
  components: {
    LoadIcon,
    QuillEditor
  },
  inject: {
    documentId: {
      default: 0
    },
    studySessionId: {
      default: null
    },
  },
  data() {
    return {
      content: "",
      originalContent: undefined,
      editable_document: undefined,
      debounceHandleSave: undefined,
      documentHash: undefined,
      textChange: debounce(this.contentChanged, 500)
    };
  },
  created() {
    /* this.debounceHandleSave = debounce(() => {
      this.contentChanged();
    }, 2000);
    */
    // Get route param
    this.documentHash = this.$route.params.documentHash;
  },
  mounted() {
    this.$socket.emit("documentGet", {documentId: this.documentId});
  },
  unmounted() {
    this.syncDocDataFromDiffData();
  },
  sockets: {
    documentFile: function (data) {
      if (data.document.id === this.documentId) {
        if (data.file !== null) {
          this.$refs.editor.setHTML(data.file);
        }
      }
    }
    /*editable_docRefresh: function (data) {
      // If eidtable document is not initialized and data is not empty
      if (this.editable_document === undefined && data.length > 0) {
        // then set eidtable document and content
        this.editable_document = data[0];
        this.content = new Delta(this.editable_document.text);
        this.originalContent = this.editable_document.text;
      }
    }*/
  },
  methods: {
    contentChanged() {
      console.log("Test")
      // Only write changes if editable document is loaded and text is changed
      /*if (this.editable_document !== undefined && this.editable_document.text !== this.content) {
        // Get document diff data
        const diffData = this.getDiffData(this.editable_document.text, this.content);

        // Update editable document
        this.editable_document.text = this.content;

        // Save document data and diff data
        this.$socket.emit("editableDocumentSilentUpdate", {
          document: this.editable_document,
          diff: diffData
        });
      }*/
    },
    handleTextChange(data) {
      console.log(data);
      /*{ delta, source, oldContents } = data;
      if (source === "user") {
        this.$socket.emit("saveDiffData", {
          editableDocId: this.editable_document.documentId,
          diffData: delta
        });
      }*/
    },
    syncDocDataFromDiffData() {
      this.$socket.emit("syncDocDataFromDiffData", {
        editableDocId: this.editable_document.documentId
      });
    },
    leave() {
      //TODO
    },
    downloadDocument() {
      var blob = new Blob([this.$refs.editor.getHTML()], {type: 'text/html;charset=utf-8;'});
      var url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.setAttribute('href', url);
      anchor.setAttribute('target', '_blank');
      anchor.style.visibility = 'hidden';
      anchor.setAttribute('download', 'document.html');
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    }
  }
};
</script>
