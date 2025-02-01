<template>
    <div class="container-fluid d-flex min-vh-100 vh-100 flex-column">
      <div class="row flex-grow-1 overflow-hidden">
        <div id="editorContainer" class="editor-container flex-grow-1">
          <Editor ref="editor" :document-id="documentId" :study-session-id="studySessionId" :study-step-id="studyStepId" :readonly="true" />
        </div>
        <Sidebar
          ref="sidebar"
          :show="isSidebarVisible"
          :edits="edits"
          class="sidebar-container"
          @add-edit="insertEditsInEditor"
        />
      </div>
    </div>
  </template>
  
/**
* Editor component having a sidebar
*
* This component provides a Quill editor to edit the document and a sidebar containing data from the editorwhich can be shown according to time stamp.
*
* @autor Juliane Bechert
*/
<script>
import Sidebar from "@/components/annotator/sidebar/Sidebar.vue"; 
import Editor from "@/components/editor/Editor.vue"; 

export default {
name: "EditorHistory", 
components: {
    Sidebar,
    Editor,
},
props: {
    documentId: {
    type: Number,
    required: true,
    },
    studySessionId: {
    type: Number,
    required: true,
    },
    studyStepId: {
    type: Number,
    required: true,
    },
},
data() {
    return {
    isSidebarVisible: true, 
    edits: []
    };
},
mounted() {
    this.$socket.emit(
    "documentGet",
    {
        documentId: this.documentId,      
        studySessionId: this.studySessionId, 
        studyStepId: this.studyStepId,
        history: true                      
    },
    (res) => {
        if (res.success) {
        this.initializeEditorWithContent(res.data.deltas);
        } else {
        this.handleDocumentError(res.error);
        }
    }
    );
},
methods: {
    insertEditsInEditor(edit) {
        const editor = this.$refs.editor; 
        if (editor) {
        editor.insertTextAtCursor(edit); 
        }
    },
    groupDeltasByDate(deltas) {
        if (!Array.isArray(deltas) || deltas.length === 0) {
            console.warn("No deltas received or deltas is not an array.");
            return {};
        }

        const groupedDeltas = {};

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const oneWeekAgo = new Date(today);
        oneWeekAgo.setDate(today.getDate() - 7);
        const oneMonthAgo = new Date(today);
        oneMonthAgo.setMonth(today.getMonth() - 1);

        deltas.forEach(delta => {
            if (!delta.updatedAt) {
                console.warn("Missing updatedAt in delta:", delta);
                return;
            }

            const updatedDate = new Date(delta.updatedAt);

            let dateGroup = "";
            if (updatedDate >= today) {
                dateGroup = "Today";
            } else if (updatedDate >= oneWeekAgo) {
                dateGroup = "This Week";
            } else if (updatedDate >= oneMonthAgo) {
                dateGroup = "Last Week";
            } else {
                dateGroup = "Older";
            }

            const exactDate = updatedDate.toISOString().split("T")[0];
            const timeLabel = updatedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            if (!groupedDeltas[dateGroup]) {
                groupedDeltas[dateGroup] = {};
            }

            if (!groupedDeltas[dateGroup][exactDate]) {
                groupedDeltas[dateGroup][exactDate] = [];
            }

            const editsOnSameDay = groupedDeltas[dateGroup][exactDate];
            const lastEdit = editsOnSameDay.length > 0 ? editsOnSameDay[editsOnSameDay.length - 1] : null;

            // Merge edits within 120 seconds (2 minutes) by the same user
            if (lastEdit && lastEdit.userId === delta.userId) {
                const lastEditTime = new Date(lastEdit.updatedAt).getTime();
                const currentEditTime = updatedDate.getTime();

                if (currentEditTime - lastEditTime <= 120000) {
                    const position = delta.offset;
                    let textArray = lastEdit.text.split("");

                    while (textArray.length < position) {
                        textArray.push(" ");
                    }
                    textArray.splice(position, 0, delta.text);

                    lastEdit.text = textArray.join("").replace(/\s+/g, " "); 
                    return;
                }
            }
            groupedDeltas[dateGroup][exactDate].push({
                ...delta,
                timeLabel, 
            });
        });
        return groupedDeltas;
    },
    initializeEditorWithContent(deltas) {
        this.edits = this.groupDeltasByDate(deltas);
    },
    handleDocumentError(error) {
      this.eventBus.emit('toast', {
        title: "Document error",
        message: error.message,
        variant: "danger"
      });
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
