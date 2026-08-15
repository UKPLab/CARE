<template>
  <!-- Error state when document not found or deleted -->
  <div v-if="documentError" class="document-error-page d-flex flex-column align-items-center justify-content-center min-vh-100">
    <div class="error-card text-center p-5 bg-body rounded shadow">
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
        this.setDocumentError(res.message, res.code);
      }
    });
  },
  methods: {
    /**
     * Set document error state with user-friendly title and message
     */
    setDocumentError(message, errorCode) {
      const titleMap = {
        'DOCUMENT_NOT_FOUND': 'Document Not Found',
        'ACCESS_DENIED': 'Access Denied',
        'FILE_MISSING': 'File Not Available',
      };

      // Use predefined message if error code exists
      this.documentError = {
        title: titleMap[errorCode] || 'Document Error',
        message: message || 'An unexpected error occurred.'
      };

      // Also emit toast for immediate feedback
      this.eventBus.emit('toast', {
        title: this.documentError.title,
        message: this.documentError.message,
        variant: "danger"
      });
    },
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
  background-color: var(--bs-tertiary-bg, #f5f5f5);
  min-height: 100vh;
}

.error-card {
  max-width: 500px;
  border: 1px solid var(--bs-border-color, #e0e0e0);
}
</style>