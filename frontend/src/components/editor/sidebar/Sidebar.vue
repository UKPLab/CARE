<template>
  <div id="sidebarContainer" class="version-history-sidebar">
    <div id="hoverHotZone"></div>
    <div id="sidebar" class="collapse collapse-horizontal border-end d-flex flex-column">
      <div id="hotZone" class="hot-zone"></div>
      <div id="sidepane" ref="sidepane">
        <div id="spacer"></div>

        <div class="edits-section" v-if="showEdits">
          <h3 class="sidebar-title">Version History</h3>
          <ul class="version-list" style="list-style: none; padding: 0;">
            <li v-for="(dateGroups, dateCategory) in edits" :key="dateCategory" class="date-group">
              <div class="group-header" @click="toggleCollapse(dateCategory)">
                <span>{{ dateCategory }}</span>
                <span v-if="collapsedGroups[dateCategory]">&#9654;</span>
                <span v-else>&#9660;</span>
              </div>

              <ul v-show="!collapsedGroups[dateCategory]" style="list-style: none; padding: 0;">
                <li v-for="(group, exactDate) in dateGroups" :key="exactDate" class="date-section">
                  <div class="date-header" @click="toggleCollapse(exactDate)">
                    <span>{{ group[0].timeLabel }}</span>
                    <span v-if="collapsedGroups[exactDate]">&#9654;</span>
                    <span v-else>&#9660;</span>
                  </div>

                  <ul v-show="!collapsedGroups[exactDate]" style="list-style: none; padding: 0;">
                    <li v-for="edit in flattenGroup(group)" :key="edit.id" class="version-item" :class="{ 'current-version': edit.isCurrentVersion }">
                      <SideCard @click="handleEditClick(edit)">
                        <template #header>
                          <div class="edit-header-line">
                            <strong>{{ new Date(edit.updatedAt).toLocaleString() }}</strong>
                          </div>
                          <div class="creator-line">
                            <span class="creator-name">{{ edit.creator_name || 'Anonymous User' }}</span>
                          </div>
                        </template>
                        <template #body>
                          <div v-if="edit.isCurrentVersion" class="current-version-body">
                            <span class="current-badge">Current Version</span>
                          </div>
                        </template>
                      </SideCard>
                    </li>
                  </ul>
                </li>
              </ul>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import SideCard from "@/components/annotator/sidebar/card/Card.vue";
  
/** Sidebar component of the Editor
 *
 * The Sidebar can show several card which can be clicked on and added to the Editor.
 *
 * @author Juliane Bechert
 */
export default {
  name: "EditorSidebar",
  components: { SideCard },
  props: {
    edits: {
      type: Object,
      required: true,
      default: () => ({}),
    },
  },
  data() {
    return {
      collapsedGroups: {},
    };
  },
  computed: {
    showEdits() {
      return this.edits && Object.keys(this.edits).length > 0;
    },
  },
  methods: {
    handleEditClick(edit) {
      this.$emit("add-edit", edit);
    },
    toggleCollapse(key) {
      this.collapsedGroups[key] = !this.collapsedGroups[key];
    },
    flattenGroup(dayGroup) {
      const versions = Object.values(dayGroup).flat();
      return versions.sort((a, b) => {
        if (a.isCurrentVersion) return -1;
        if (b.isCurrentVersion) return 1;
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      });
    },
  },
};
</script>

<style scoped>
.version-history-sidebar {
  background-color: #f8f9fa;
  border-right: 1px solid #ddd;
  overflow-y: auto;
  padding: 15px;
  height: 100vh;
  min-width: 300px;
  max-width: 350px;
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
}

.sidebar-title {
  font-size: 1.4rem;
  font-weight: bold;
  margin-bottom: 10px;
}

.group-header, .date-header {
  cursor: pointer;
  padding: 8px 10px;
  background-color: #e9ecef;
  margin: 5px 0;
  font-weight: bold;
  border-radius: 2px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.group-header:hover, .date-header:hover {
  background-color: #d6d8db;
}

.version-item {
  padding: 8px 10px; 
  background: white;
  border: 1px solid #ddd;
  margin: 5px 0;
  border-radius: 5px;
  transition: background 0.3s;
  cursor: pointer;
}

.version-item:hover {
  background-color: #f1f3f5;
}

.current-version {
  border-left: 4px solid #28a745;
  background-color: #e6f4ea;
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

.creator-name {
  color: #555;
  font-size: 0.85rem;
  margin-top: 2px;
  font-weight: 500;
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

.bi-person-fill {
  font-size: 1rem;
  color: #28a745;
}
</style>
