<template>
  <QuillEditor v-model:content="content" content-type="html" theme="snow" :on-update:content="debounceHandleSave()" />
</template>

<script>
import { QuillEditor } from "@vueup/vue-quill";
import "@vueup/vue-quill/dist/vue-quill.snow.css";
import debounce from "lodash.debounce";
import { diffChars } from "diff";

export default {
  name: "EditorComponent",
  components: {
    QuillEditor
  },
  props: {
    documentId: {
      type: Number,
      required: true,
    },
  },
  data() {
    return {
      content: "",
      originalContent: undefined,
      editable_document: undefined,
      debounceHandleSave: undefined,
      documentHash: undefined
    };
  },
  created() {
    this.debounceHandleSave = debounce(() => {
      this.contentChanged();
    }, 2000);

    // Get route param
    this.documentHash = this.$route.params.documentHash;

    window.addEventListener("beforeunload", this.handleBeforeunload);
  },
  mounted() {
    // Get or create editable document for this document
    this.$socket.emit("editableDocumentGetOrCreateForDocument", { documentId: this.documentId, text: "" });
  },
  unmounted() {
    this.saveCompleteDocment();
    window.removeEventListener("beforeunload", this.handleBeforeunload);
  },
  sockets: {
    editable_docRefresh: function (data) {
      // If eidtable document is not initialized and data is not empty
      if (this.editable_document === undefined && data.length > 0) {
        // then set eidtable document and content
        this.editable_document = data[0];
        this.content = this.editable_document.text;
        this.originalContent = this.editable_document.text;
      }
    }
  },
  methods: {
    contentChanged() {
      // Only write changes if editable document is loaded and text is changed
      if (this.editable_document !== undefined && this.editable_document.text !== this.content) {
        // Get document diff data
        const diffData = this.getDiffData(this.editable_document.text, this.content);

        // Update editable document
        this.editable_document.text = this.content;

        // Save document data and diff data
        this.$socket.emit("editableDocumentSilentUpdate", {
          document: this.editable_document,
          diff: diffData
        });
      }
    },
    getDiffData(oldStr, newStr) {
      const ret = [];

      const diffArray = diffChars(oldStr, newStr);
      console.log("diffArray:", diffArray);
      let currentIndex = 0;

      diffArray.forEach((item) => {
        const activeData = {
          active: undefined,
          value: item.value,
          newPos: currentIndex,
          value: item.value
        };

        if (item.added) {
          activeData.active = "added";
        } else if (item.removed) {
          activeData.active = "removed";
        }

        if (!item.removed) {
          currentIndex += item.count;
        }

        if (activeData.active) ret.push(activeData);
      });

      console.log("ret:", ret);

      return ret;
    },

    // Save document data
    saveCompleteDocment() {
      this.$socket.emit("saveDocumentData", {
        hash: this.documentHash,
        data: this.content
      });
    },
    handleBeforeunload(event) {
      if (this.originalContent === this.content) return;

      event.preventDefault();
      event.returnValue = "";
      return event;
    }
  }
};
</script>
