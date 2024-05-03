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

        <QuillEditor ref="editor" v-model:content="content" theme="snow" @text-change="handleTextChange"/>

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

export default {
  name: "EditorView",
  fetch_data: ['document_edit'],
  components: {
    LoadIcon,
    QuillEditor
  },
  //computed - getFiltered nach nicht applied und später watch (hier nach empty abfragen)
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
      documentHash: undefined,
      textChange: debounce(this.handleTextChange, 500),
    };
  },
  created() {
    // Get route param
    this.documentHash = this.$route.params.documentHash;
  },
  mounted() {
      console.log("Attempting to connect to socket...");
      this.$socket.emit("documentGet", { documentId: this.documentId});
      console.log("documentId:",this.documentId);

      this.$socket.on('document_editRefresh', this.initializeEditorWithContent);

      this.$socket.on('documentError', (error) => {
        console.error('Document error:', error.message);
        this.handleDocumentError(error);
      });

      this.$socket.on('connect', () => {
          console.log('Socket connected:', this.$socket.id);
      });
  },
  sockets: {
    documentFile: function (data) {
      if (data.document.id === this.documentId) {
        if (data.file !== null) {
          this.$refs.editor.setHTML(data.file);
        }
      }
    }
  },
  methods: {
    handleTextChange({ delta, oldContents, source }) {
      console.log("Editor Change Detected:", delta);
      if (source === 'user') {
        this.processDelta(delta);
      }
    },

    processDelta(delta) {
      console.log("Processing delta:", delta);
      const ops = delta.ops;
      const dbOps = this.deltaToDatabaseOps(ops);
      console.log("Processed Delta to DB Operations:", dbOps);
      this.$socket.emit('documentEdit', { documentId: this.documentId, ops: dbOps });
      console.log("Emitting edit operation to server:", { userId: this.userId, documentId: this.documentId, ops: dbOps});
    },

    deltaToDatabaseOps(ops) {
      let offset = 0;
      return ops.map(op => {
        let dbOp = {
          offset,
          operationType: this.getOperationType(op),
          span: this.getSpan(op),
          text: op.insert || null,
          attributes: op.attributes || null
        };
        if (op.retain) {
          offset += op.retain;
        } else if (op.insert && typeof op.insert === 'string') {
          offset += op.insert.length;
        }
        return dbOp;
      });
    },

    getOperationType(op) {
      if ('insert' in op) {
        return 0; // Insert
      } else if ('delete' in op) {
        return 1; // Delete
      } else if ('retain' in op) {
        return 2; // Retain
      } else {
        throw new Error('Unsupported operation type');
      }
    },

    getSpan(op) {
      return op.retain || op.delete || (op.insert ? op.insert.length : 1);
    },

    async leave() {
      // Check if document_edits is defined and not null
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

    initializeEditorWithContent(data) {
        console.log("Received document content from server:", data);
        if (data.documentId === this.documentId) {
            const { edits } = data;
            this.content = this.reconstructDocumentFromEdits(edits);
            this.$refs.editor.setHTML(this.content);
        }
    },

    reconstructDocumentFromEdits(edits) {
        console.log("Reconstructing document from edits:", edits);
        
        edits.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        let content = '';
        edits.forEach(edit => {
            switch(edit.operationType) {
                case 0: // Insert
                    // Insert text at the specified offset
                    content = this.applyInsert(content, edit.text, edit.offset);
                    break;
                case 1: // Delete
                    // Delete text starting from the specified offset
                    content = this.applyDelete(content, edit.offset, edit.span);
                    break;
                case 2: // Retain
                    // Apply attribute changes if any (not handled here as text is plain)
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

    handleDocumentError(error) {
        alert(`Error: ${error.message}`);
    },
    
  }
};
</script>