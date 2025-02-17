<template>
  <div>
    <h3 class="sidebar-title">Version History</h3>

    <div v-for="group in Object.keys(periodEdits)" :key="group">
      <div v-if="periodEdits[group].length > 0">
        <span class="small">{{ group }}</span>

        <ul class="list-group">
          <li
            v-for="editGroup in periodEdits[group]"
            :key="editGroup[0].id"
            class=" list-group-item "
          >
            <div :id="'dropdown_' + editGroup[0].id"
                 class="dropdown btn d-flex justify-content-between align-items-start"
                 data-bs-toggle="dropdown"
                 aria-expanded="false">
              <div class="ms-2 me-auto">
                <div class=" fw-bold
              ">{{ new Date(editGroup[0].createdAt).toLocaleString() }}
                </div>
                <div class="text-start">{{ editGroup[0].creator_name || 'Anonymous User' }}
                  <span v-if="editGroup.includes(currentVersion)" class="current-badge">Current Version</span>
                </div>
                <ul class="dropdown-menu" :aria-labelledby="'dropdown_' + editGroup[0].id">
                  <li v-for="edit in editGroup" :key="edit.id">
                    <a class="dropdown-item" @click="selectEdit(edit)">
                      <div class="edit-header-line">
                        <strong>{{ new Date(edit.createdAt).toLocaleString() }}</strong>
                      </div>
                      <div v-if="currentVersion.id === edit.id" class="current-version-body">
                        <span class="current-badge">Current Version</span>
                      </div>
                    </a>
                  </li>
                </ul>
              </div>
              <span class="badge bg-primary rounded-pill">{{ editGroup.length }}</span>
            </div>
          </li>
        </ul>

      </div>
    </div>
  </div>
</template>

<script>
/**
 * Edit History
 *
 * The Sidebar Module shows the edit history of the document.
 *
 * @author Dennis Zyska, Juliane Bechert
 */
export default {
  name: "SidebarHistory",
  inject: {
    studySessionId: {
      type: Number,
      required: false,
      default: null // Allows for null if not in a study session
    },
    documentId: {
      type: Number,
      required: true,
      default: 0,
    },
    studyStepId: {
      type: Number,
      required: false,
      default: null,
    },
  },
  unmounted() {
    if (this.currentVersion) {
      this.currentVersion.isCurrentVersion = false;
    }
    this.eventBus.emit("editorSelectEdit", -1);
  },
  computed: {
    allEdits() {
      return this.$store.getters["table/document_edit/getFiltered"](
        (e) => e.documentId === this.documentId
          && e.studySessionId === this.studySessionId
          && e.studyStepId === this.studyStepId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    currentVersion() {
      if (this.allEdits.length === 0) {
        return null;
      }
      const current = this.allEdits.find(e => e.isCurrentVersion);
      if (current !== undefined) {
        return current;
      }
      return this.allEdits[0];
    },
    groupedEdits() {
      const groups = [];
      let currentGroup = [this.allEdits[0]];
      let currentUser = this.allEdits[0]?.userId;

      for (let i = 1; i < this.allEdits.length; i++) {
        const diff = new Date(this.allEdits[i - 1].createdAt) - new Date(this.allEdits[i].createdAt);
        if (diff > this.historyGroupTime || this.allEdits[i].userId !== currentUser) {
          groups.push(currentGroup);
          currentGroup = [];
        }

        currentGroup.push(this.allEdits[i]);
        currentUser = this.allEdits[i].userId;
      }

      groups.push(currentGroup);

      return groups;
    },
    periodEdits() {
      const categories = {
        "Today": [],
        "Yesterday": [],
        "This week": [],
        "Last week": [],
        "This month": [],
        "Last month": [],
        "Older": [],
      };

      if (this.groupedEdits.length === 0 || this.groupedEdits[0].length === 0) {
        return categories;
      }

      const now = new Date();
      const startOfToday = new Date(now.setHours(0, 0, 0, 0));
      const startOfYesterday = new Date(startOfToday - 1000 * 60 * 60 * 24);
      const startOfThisWeek = new Date(startOfToday - 1000 * 60 * 60 * 24 * startOfToday.getDay());
      const startOfLastWeek = new Date(startOfThisWeek - 1000 * 60 * 60 * 24 * 7);
      const startOfThisMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);
      const startOfLastMonth = new Date(startOfThisMonth - 1000 * 60 * 60 * 24 * 31);

      for (const group of this.groupedEdits) {
        const firstEdit = group[0];
        if (!firstEdit) {
          continue;
        }
        const createdAt = new Date(firstEdit.createdAt);

        if (createdAt >= startOfToday) {
          categories["Today"].push(group);
        } else if (createdAt >= startOfYesterday) {
          categories["Yesterday"].push(group);
        } else if (createdAt >= startOfThisWeek) {
          categories["This week"].push(group);
        } else if (createdAt >= startOfLastWeek) {
          categories["Last week"].push(group);
        } else if (createdAt >= startOfThisMonth) {
          categories["This month"].push(group);
        } else if (createdAt >= startOfLastMonth) {
          categories["Last month"].push(group);
        } else {
          categories["Older"].push(group);
        }
      }

      return categories;
    },
    user() {
      return this.$store.getters["auth/getUser"];
    },
    historyGroupTime() {
      return parseInt(this.$store.getters["settings/getValue"]('editor.edits.historyGroupTime'));
    },
  },
  methods: {
    selectEdit(edit) {
      this.eventBus.emit("editorSelectEdit", edit.id);
      if (this.currentVersion) {
        this.currentVersion.isCurrentVersion = false;
      }
      edit.isCurrentVersion = true;
      if (this.user.acceptStats) {
        this.$socket.emit("stats", {
          action: "editorHistorySelect",
          data: {
            documentId: this.documentId,
            studySessionId: this.studySessionId,
            studyStepId: this.studyStepId,
            editId: edit.id,
            acceptDataSharing: this.user.acceptDataSharing
          }
        })
      }
    },
  },
};
</script>

<style scoped>
.sidebar-title {
  font-size: 1.4rem;
  font-weight: bold;
  margin-bottom: 10px;
  margin-top: 2px;
}

.current-badge {
  background-color: #28a745;
  color: white;
  padding: 2px 6px;
  font-size: 0.75rem;
  border-radius: 4px;
  font-weight: bold;
  margin-left: 8px;
}


.edit-header-line,
.creator-line {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 0 5px;
  margin: 0;
  text-align: left;
}

</style>
