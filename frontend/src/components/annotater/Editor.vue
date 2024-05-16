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

        <QuillEditor ref="editor" v-model:content="content" :options="editorOptions" @text-change="handleTextChangeDebounced"/>

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
 * @author Zheyu Zhang, Juliane Bechert
 */
import {Delta, QuillEditor} from "@vueup/vue-quill";
import "@vueup/vue-quill/dist/vue-quill.snow.css";
import debounce from "lodash.debounce";
import LoadIcon from "@/basic/Icon.vue";
import {convert} from "editor-delta-conversion";
import {deltaToDb} from "editor-delta-conversion";

export default {
  name: "EditorView",
  fetch_data: ['document_edit'],
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
    userId: {
    default: null
  }
  },
  data() {
    return {
      content: "",
      originalContent: undefined,
      editable_document: undefined,
      debounceHandleSave: undefined,
      documentHash: this.$route.params.documentHash,
      handleTextChangeDebounced: null
    };
  },
  created() {
    this.documentHash = this.$route.params.documentHash;
  },
  mounted() {
      this.$socket.emit("documentGet", { documentId: this.documentId});

      this.$socket.on('document_editRefresh', (edits) => {
        this.initializeEditorWithContent(edits);
      });

      this.$socket.on('documentError', (error) => {
        console.error('Document error:', error.message);
        this.handleDocumentError(error);
      });

      this.$socket.on('connect', () => {
          console.log('Socket connected:', this.$socket.id);
      });

      // Dynamically set the text change handler based on the debounce time
      if (this.debounceTimeForEdits > 0) {
        this.handleTextChangeDebounced = debounce(this.handleTextChange, this.debounceTimeForEdits);
      } else {
        this.handleTextChangeDebounced = this.handleTextChange;
      }
  },
  unmounted() {
    this.$socket.emit('documentSave', { documentId: this.documentId });
  },
  computed: {
    unappliedEdits() {
      return this.$store.getters["table/document_edit/getFiltered"](
        e => e.applied === false
      ).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    },
    debounceTimeForEdits() {
      return parseInt(this.$store.getters["settings/getValue"]('editor.edits.debounceTime'), 10);
    },
    editorOptions() {
        const toolbarVisible = this.$store.getters["settings/getValue"]('editor.toolbar.visibility') === 'true';
        return {
            modules: {
                toolbar: toolbarVisible ? undefined : false // Use false to hide, undefined to show default toolbar
            },
            theme: 'snow'
        };
    }
  },
  watch: {
    unappliedEdits: {
      handler(newEdits) {
        if (newEdits.length > 0) {
          this.initializeEditorWithContent(newEdits); 
        }
      },
      deep: true 
    }
  },
  methods: {
    handleTextChange({ delta, oldContents, source }) {
      if (source === 'user') {
        this.processDelta(delta);
      }
    },

    processDelta(delta) {
      console.log(delta.ops);
      console.log(deltaToDb(delta.ops));
      this.$socket.emit('documentEdit', { documentId: this.documentId, ops: deltaToDb(delta.ops) });
    },




    async leave() {
      if (this.document_edits && this.document_edits.length > 0 && this.document_edits.filter(edit => edit.draft).length > 0) {
        return new Promise((resolve, reject) => {
          this.$refs.leavePageConf.open(
              "Unsaved Changes",
              "Are you sure you want to leave? There are unsaved changes, which will be lost.",
              null,
              function (val) {
                return resolve(val);
              });
        });
      } else {
        return true;
      }
    },

    /*
    // setText needs to be changed into setContents or updateContents: https://quilljs.com/docs/api#content-container
    // attempt to do so can be found below in the comment, to use the code in comments, comment out line 205-255
    initializeEditorWithContent(edits) {
      const unwrappedEdits = edits.map(edit => ({
          id: edit.id,
          documentId: edit.documentId,
          draft: edit.draft,
          offset: edit.offset,
          operationType: edit.operationType,
          span: edit.span,
          text: edit.text,
          attributes:edit.attributes,
      }));

      const reconstructedContent = this.reconstructDocumentFromEdits(unwrappedEdits);

      this.content = reconstructedContent;

      this.$refs.editor.setText(this.content);

      this.$store.commit("table/document_edit/applyEdits", edits.map(edit => edit.id));

    },

    reconstructDocumentFromEdits(edits) {
      edits.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      let content = '';

      edits.forEach(edit => {
          switch(edit.operationType) {
              case 0: // Insert
                  content = this.applyInsert(content, edit.text, edit.offset);
                  break;
              case 1: // Delete
                  content = this.applyDelete(content, edit.offset, edit.span);
                  break;
              case 2: // Retain
                  break;
          }
      });

      return content;
    },

    applyInsert(content, text, offset) {
      if (offset > content.length) offset = content.length;
      return content.slice(0, offset) + text + content.slice(offset);
    },

    applyDelete(content, offset, span) {
      if (offset > content.length) return content;
      return content.substring(0, offset) + content.substring(offset + span);
    },

    /* This code transforms the edits into deltas and uses updateContents() instead of setText() but trows error:@vueup_vue-quill.js?v=c1bf69a2:13746 Uncaught (in promise) Error: diff() called on non-document
*/
    initializeEditorWithContent(edits) {
      console.log("Edits:",edits);
      const delta = convert(edits);
      console.log("Converted Deltas:",delta);

      this.content = delta;
      
      if (this.$refs.editor && this.$refs.editor.quill) {
        console.log("Updating contents with delta:", delta);
        if (delta.ops.length > 0) {
          this.$refs.editor.quill.updateContents(delta, 'silent');
        } else {
          console.warn("Empty Delta, not applying to editor.");
        }
      }

      this.$store.commit("table/document_edit/applyEdits", edits.map(edit => edit.id));
    },


    handleDocumentError(error) {
      alert(`Error: ${error.message}`);
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

<style scoped>
/* This targets the toolbar part of the Quill editor and hides it */
.ql-toolbar {
  display: none;
}
</style>