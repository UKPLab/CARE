<template>
    <div class="container-fluid d-flex min-vh-100 vh-100 flex-column">
      <div class="row flex-grow-1 overflow-hidden">
        <div id="editorContainer" class="editor-container flex-grow-1">
          <Editor ref="editor" :document-id="documentId" :study-step-id="studyStepId" :active="active" />
        </div>
        <Sidebar
          ref="sidebar"
          :show="isSidebarVisible"
          :placeholders="placeholders"
          class="sidebar-container"
          @add-placeholder="insertPlaceholderInEditor"
        />
      </div>
    </div>
  </template>
  
/**
* Editor component having a sidebar
*
* This component provides a Quill editor to edit the document and a sidebar containing placeholders that can be added to the Editor document.
*
* @autor Juliane Bechert
*/
<script>
import Sidebar from "@/components/annotator/sidebar/Sidebar.vue"; 
import Editor from "@/components/editor/Editor.vue"; 

export default {
name: "EditorWithSidebar", 
components: {
    Sidebar,
    Editor,
},
props: {
    documentId: {
    type: Number,
    required: true,
    },
    studyStepId: {
    type: Number,
    required: false,
    default: null,
    },
    active: {
    type: Boolean,
    required: false,
    default: true,
    },
},
data() {
    return {
    isSidebarVisible: true, 
    placeholders: [
    { id: "placeholder1", label: "Placeholder to insert a link", text: "~link\\[(\\d+)\\]~" },
    { id: "placeholder2", label: "Placeholder to insert a nlp model", text: "~nlp\\[(\\d+)\\]~" },
    ],
    };
},
methods: {
    insertPlaceholderInEditor(placeholderText) {
        const editor = this.$refs.editor; 
        if (editor) {
        editor.insertTextAtCursor(placeholderText); 
        }
    },
},
};
</script>

<style scoped>
.container-fluid {
  display: flex;
  flex-direction: column;
  height: 100%; 
  overflow: hidden;
}

.row {
  display: flex;
  flex-direction: row;
  height: 100%; 
}

.editor-container {
  flex: 1;
  overflow: hidden; 
  min-width: 0; 
}

.sidebar-container {
  width: 300px; 
  max-width: 300px; 
  min-width: 300px;
  background-color: #f8f9fa; 
  border-left: 1px solid #ddd;
  overflow-y: auto;
  margin-top: 60px; 
}

.top-padding {
  padding-top: 10px; 
}
</style>