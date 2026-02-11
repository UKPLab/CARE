<template>
  <!-- Error state when document not found or deleted -->
  <div v-if="documentError" class="document-error-page d-flex flex-column align-items-center justify-content-center min-vh-100">
    <div class="error-card text-center p-5 bg-white rounded shadow">
      <i class="bi bi-file-earmark-x text-danger" style="font-size: 5rem;"></i>
      <h2 class="mt-4 text-danger">{{ documentError.title }}</h2>
      <p class="text-muted mb-4">{{ documentError.message }}</p>
      <div class="d-flex gap-3 justify-content-center">
        <router-link to="/" class="btn btn-primary">
          <i class="bi bi-house me-2"></i>Go to Dashboard
        </router-link>
      </div>
    </div>
  </div>

  <Loader
    v-else-if="documentId === 0"
    :loading="true"
    class="pageLoader"
  />
  <span v-else>
    <Editor v-if="document.type === 1 || document.type === 2" ref="editor" :document-id="documentId"/>
    <Annotator v-else ref="annotator" :document-id="documentId"/>
  </span>
</template>

<script>
/**
 * Standard document view without sessions, studies or reviews
 *
 * Loads a document, allows the user to annotate the document. The annotations are not associated with a study or
 * session. The users may simply share the link to this view after publication, to allow other users to
 * collaboratively work on a paper.
 *
 * @author: Dennis Zyska, Nils Dycke
 */

import Annotator from "./annotator/Annotator.vue";
import Loader from "@/basic/Loading.vue";
import Editor from "@/components/editor/Editor.vue"

export default {
  name: "DocumentRoute",
  components: {Annotator, Loader, Editor},
  props: {
    'documentHash': {
      type: String,
      required: true
    },
  },
  data() {
    return {
      documentId: 0,
      documentError: null,
    }
  },
  computed: {
    document() {
      return this.$store.getters["table/document/getByHash"](this.documentHash);
    },
  },
  watch: {
    document(newVal) {
      if (newVal) {
        this.documentId = newVal.id;
      } else {
        this.documentId = 0
      }
    },
  },
  mounted() {
    this.$socket.emit("documentGetByHash", {documentHash: this.documentHash}, (res) => {
      if (!res.success) {
        this.documentId = res.documentId;
        const {errorCode, message} = this.parseErrorMessage(res.message);
        this.setDocumentError(message, errorCode);
      }
    });
  },
  sockets: {
    documentError: function (data) {
      if (data.documentHash === this.documentHash) {
        this.setDocumentError(data.message, data.errorCode);
      }
    }
  },
  methods: {
    /**
     * Parse "ERROR_CODE|message" format from server error
     */
    parseErrorMessage(raw) {
      const idx = raw ? raw.indexOf('|') : -1;
      if (idx > 0) {
        return { errorCode: raw.substring(0, idx), message: raw.substring(idx + 1) };
      }
      return { errorCode: null, message: raw };
    },
    /**
     * Set document error state with user-friendly title and message
     */
    setDocumentError(message, errorCode) {
      const errorMap = {
        'DOCUMENT_NOT_FOUND': {
          title: 'Document Not Found',
          message: 'The document you are looking for does not exist or has been deleted.'
        },
        'ACCESS_DENIED': {
          title: 'Access Denied',
          message: 'You don\'t have permission to view this document.'
        },
        'FILE_MISSING': {
          title: 'File Not Available',
          message: 'The document file could not be found on the server.'
        }
      };
      
      // Use predefined message if error code exists
      if (errorCode && errorMap[errorCode]) {
        this.documentError = errorMap[errorCode];
      } else {
        // Parse message to determine error type
        this.documentError = this.parseServerError(message);
      }
      
      // Also emit toast for immediate feedback
      this.eventBus.emit('toast', {
        title: this.documentError.title,
        message: this.documentError.message,
        variant: "danger"
      });
    },

    /**
     * Parse server error message to user-friendly format
     */
    parseServerError(message) {
      if (!message) {
        return { title: "Error", message: "An unexpected error occurred." };
      }
      
      const lower = message.toLowerCase();
      if (lower.includes("does not exist") || lower.includes("deleted")) {
        return { 
          title: "Document Not Found", 
          message: "This document has been deleted or no longer exists." 
        };
      }
      if (lower.includes("access") || lower.includes("rights")) {
        return { 
          title: "Access Denied", 
          message: "You don't have permission to view this document." 
        };
      }
      if (lower.includes("missing") || lower.includes("not found")) {
        return { 
          title: "File Not Available", 
          message: "The document file could not be found on the server." 
        };
      }
      return { title: "Document Error", message: message };
    }
  }
}
</script>

<style scoped>
.pageLoader {
  position: absolute;
  top: 25%;
  left: 50%;
  transform: translate(-50%, -50%)
}

.document-error-page {
  background-color: #f5f5f5;
  min-height: 100vh;
}

.error-card {
  max-width: 500px;
  border: 1px solid #e0e0e0;
}
</style>