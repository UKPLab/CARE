<template>
  <QuillEditor v-model:content="content" content-type="html" theme="snow" :on-update:content="debounceHandleSave()" />
</template>

<script>
import { QuillEditor } from '@vueup/vue-quill';
import '@vueup/vue-quill/dist/vue-quill.snow.css';
import debounce from 'lodash.debounce';
import { diffChars } from 'diff';

/**
 * Editor component
 * 
 * This component provides a Quill editor to edit the document.
 * 
 * @author Zheyu Zhang
 */

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
      editable_document: undefined,
      debounceHandleSave: undefined
    };
  },
  created() {
    this.debounceHandleSave = debounce(() => {
      this.contentChanged();
    }, 2000); // 2 seconds
  },
  mounted() {
    // Get or create editable document for this document
    this.$socket.emit("editableDocumentGetOrCreateForDocument", { documentId: this.documentId, text: "" });
  },
  sockets: {
    editable_docRefresh: function (data) {
      // If eidtable document is not initialized and data is not empty
      if (this.editable_document === undefined && data.length > 0) {
        // then set eidtable document and content
        this.editable_document = data[0];
        this.content = this.editable_document.text;
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
    }
  }
};
</script>
