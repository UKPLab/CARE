<template>
    <div class="container-fluid d-flex min-vh-100 vh-100 flex-column">
      <div class="row flex-grow-1 overflow-hidden">
        <div id="editorContainer" class="editor-container flex-grow-1">
          <Editor ref="editor" :document-id="documentId" :study-session-id="studySessionId" :study-step-id="studyStepId" :readonly="true" />
        </div>
        <Sidebar ref="sidebar" :show="isSidebarVisible" :edits="groupedEdits" class="sidebar-container" @add-edit="insertEditsInEditor" />
      </div>
      <Teleport to="#topbarCenterPlaceholder">
        <div v-show="readOnlyComputed" title="Read-only">
          <span :style="{ color: '#800000', fontWeight: 'bold' }">Read-only</span>
          <LoadIcon :size="22" :color="'#800000'" icon-name="lock-fill" />
        </div>
      </Teleport>
    </div>
</template>
  
/**
* Editor component having a sidebar
*
* This component provides a Quill editor to edit the document and a sidebar containing data from the editor which can be shown according to time stamp.
*
* @autor Juliane Bechert
*/
<script>
import Sidebar from "@/components/editor/sidebar/Sidebar.vue"; 
import Editor from "@/components/editor/Editor.vue"; 
import LoadIcon from "@/basic/Icon.vue";

import { dbToDelta} from "editor-delta-conversion";

export default {
  name: "EditorHistory",
  components: {
    Sidebar,
    Editor,
    LoadIcon,
  },
  provide() {
    return {
      readonly: true,
    };
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
      groupedEdits: {},
      currentVersion: null,
      latestTimestamp: null,
    };
  },
  mounted() {
    this.fetchDocument();
  },
  computed: {
    readOnlyComputed() {
      return true; 
    },
    history() {
      return this.$route.meta.history !== undefined && this.$route.meta.history;
    },
    allEdits() {
      return this.$store.getters["table/document_edit/getAll"];
    },
    groupedEdits() {
      return this.groupDeltasByDate(this.allEdits);
    }
  },
  methods: {
    fetchDocument() {
        this.$socket.emit(
          "documentGet",
          {
            documentId: this.documentId,
            studySessionId: this.studySessionId,
            studyStepId: this.studyStepId,
            history: this.history,
          },
          (res) => {
            if (res.success) {
              this.eventBus.emit("toast", {
                title: "Retrieved update",
                message: "Data was updated!",
                variant: "success",
            });
            } else {
              this.eventBus.emit("toast", {
                title: "Retrieving failed",
                message: res.message,
                variant: "danger",
              });
            }
          }
        );
    },
    insertEditsInEditor(selectedEdit) {
      const editor = this.$refs.editor;
      if (editor && typeof editor.insertTextAtCursor === 'function') {
        const selectedTime = new Date(selectedEdit.createdAt).getTime();
        let relevantEdits = [];

        for (const date in this.groupDeltasByDate(this.allEdits)) {
          const dayGroup = this.groupDeltasByDate(this.allEdits)[date];
          for (const minute in dayGroup) {
            const minuteGroup = dayGroup[minute];
            for (const edit of minuteGroup) {
              const plainEdit = JSON.parse(JSON.stringify(edit));
              const editTime = new Date(plainEdit.createdAt).getTime();
              if (editTime <= selectedTime) {
                relevantEdits.push(plainEdit);
              }
            }
          }
        }

        if (typeof editor.clearEditor === 'function') {
          editor.clearEditor();
        }

        const combinedDelta = dbToDelta(relevantEdits);
        if (combinedDelta && combinedDelta.ops) {
          const combinedText = combinedDelta.ops
            .map(op => (op.insert ? op.insert : '')) 
            .join('');

          editor.insertTextAtCursor(combinedText);
        } else {
          console.warn("No operations in combined delta.");
        }
      } else {
        console.error("Editor instance not found or insertTextAtCursor not defined.");
      }
    },
    groupDeltasByDate(deltas) {
        if (!Array.isArray(deltas) || deltas.length === 0) {
            console.warn("No deltas received or deltas is not an array.");
            return {};
        }

        const groupedDeltas = {};
        let latestDelta = null;

        deltas.forEach(delta => {
            if (!delta.updatedAt) {
            console.warn("Missing updatedAt in delta:", delta);
            return;
            }

            const updatedDate = new Date(delta.updatedAt);
            const dateKey = updatedDate.toISOString().split("T")[0];
            const minuteKey = updatedDate.toISOString().slice(0, 16);
            const timeLabel = updatedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            if (!groupedDeltas[dateKey]) {
            groupedDeltas[dateKey] = {};
            }

            if (!groupedDeltas[dateKey][minuteKey]) {
            groupedDeltas[dateKey][minuteKey] = [];
            }

            const deltaCopy = {
            ...delta,
            timeLabel,
            isCurrentVersion: false, 
            };

            groupedDeltas[dateKey][minuteKey].push(deltaCopy);

            if (!latestDelta || new Date(delta.updatedAt) > new Date(latestDelta.updatedAt)) {
            latestDelta = deltaCopy; 
            }
        });

        if (latestDelta) {
            latestDelta.isCurrentVersion = true; 
        }

        const sortedGroupedDeltas = {};
        Object.keys(groupedDeltas)
            .sort((a, b) => new Date(b) - new Date(a))
            .forEach(date => {
            sortedGroupedDeltas[date] = {};
            Object.keys(groupedDeltas[date])
                .sort((a, b) => new Date(b) - new Date(a))
                .forEach(minute => {
                sortedGroupedDeltas[date][minute] = groupedDeltas[date][minute].sort(
                    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
                );
                });
            });

        return sortedGroupedDeltas;
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
