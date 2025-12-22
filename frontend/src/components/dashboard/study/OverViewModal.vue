<template>
  <BasicModal
    ref="overviewModal"
    name="overviewModal"
    size="xl"
  >
    <template #title>
      <h5 class="modal-title">Study Sessions Overview</h5>
    </template>
    <template #body>
      <div class="filters-container mb-3">
        <div class="d-flex-col align-items-center gap-3">
          <div class="form-check form-switch">                  
            <label class="form-check-label" for="showOpenStudiesSwitch">
                show only open studies
            </label>
             <input
              id="showOpenStudiesSwitch"
              v-model="filters.showOpenStudies"
              class="form-check-input"
              type="checkbox"
              role="switch"
            >
          </div>          
          <div class="d-flex align-items-center gap-2">
            <label for="workflowSelect" class="mb-0">Filter Workflow type:</label>
            <select
              id="workflowSelect"
              v-model="filters.workflowType"
              class="form-select form-select-sm"
              style="width: auto;"
            >
              <option value="all">All Workflows</option>
              <option
                v-for="workflow in workflowTypes"
                :key="workflow.id"
                :value="workflow.id.toString()"
              >
                {{ workflow.name }}
              </option>
            </select>
          </div>
        </div>
      </div>
      <BasicTable
        :columns="columns"
        :data="filteredStudySessions"
        :options="tableOptions"
        @action="handleAction"
      />
    </template>
    <template #footer>
      <BasicButton
        class="btn btn-secondary"
        title="Close"
        @click="close"
      />
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";

/**
 * Modal to show an overview of all study sessions
 * 
 * This modal displays all study sessions in a table format,
 * allowing administrators to view session details, status, and user information.
 * 
 * @author: Karim Ouf
 */
export default {
  name: "OverViewModal",
  components: { BasicModal, BasicTable, BasicButton },
  subscribeTable: ["study_session", "study", "workflow", "user", "study_step"],
  data() {
    return {
      filters: {
        showOpenStudies: true,
        workflowType: "all"
      },
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 20,
        search: true,
      },
      columns: [
        { name: "Study Name", key: "studyName", sortable: true },
        { name: "First Name", key: "firstName", sortable: true },
        { name: "Last Name", key: "lastName", sortable: true },
        { name: "Max Step", key: "currentStep", sortable: true },
        { name: "Created At", key: "createdAt", sortable: true },
        {
          name: "Status",
          key: "status",
          type: "badge",
          sortable: true,
          typeOptions: {
            keyMapping: {
              Running: "Running",
              Finished: "Finished",
            },
            classMapping: {
              Running: "bg-primary",
              Finished: "bg-success",
            }
          }
        },
      ],
    };
  },

  computed: {
    workflowTypes() {
      return this.$store.getters["table/workflow/getAll"] || [];
    },
    studySessions() {
      const sessions = this.$store.getters["table/study_session/getAll"] || [];
      const studies = this.$store.getters["table/study/getAll"] || [];

      
      return sessions.map((session) => {
        const study = studies.find(s => s.id === session.studyId);
        const currentStepIndex = this.getStudyStepIndex(session.studyId, session.studyStepIdMax);
        
        return {
          id: session.id,
          studyId: session.studyId,
          studyName: study.name,
          firstName: this.getUserName(session.userId).firstName,
          lastName: this.getUserName(session.userId).lastName,
          currentStep: currentStepIndex !== null ? `Step ${currentStepIndex + 1}` : 'N/A',
          createdAt: new Date(session.createdAt).toLocaleString(),
          updatedAt: new Date(session.updatedAt).toLocaleString(),
          status: session.end === null ? "Running" : "Finished",
          hash: session.hash,
        };
      });
    },
    filteredStudySessions() {
      return this.studySessions.filter(session => {
        const study = this.$store.getters["table/study/get"](session.studyId);
        if (!study) return false;

        // Filter by study closed status
        if (this.filters.showOpenStudies && study.closed !== null) {
          return false;
        }
        if (!this.filters.showOpenStudies && study.closed === null) {
          return false;
        }


        // Filter by workflow type
        if (this.filters.workflowType !== "all" && 
            study.workflowId.toString() !== this.filters.workflowType) {
          return false;
        }

        return true;
      });
    },
  },
  methods: {
    getStudyStepIndex(studyId, studyStepIdMax) {
      if (!studyStepIdMax) return null;
      
      const steps = this.$store.getters["table/study_step/getFiltered"](
        (s) => s.studyId === studyId
      );
      
      if (!steps || !steps.length) return null;

      const nextMap = new Map(steps.map(s => [s.studyStepPrevious, s]));

      let current = steps.find(s => s.studyStepPrevious == null);
      
      let index = 0;
      while (current) {
        if (current.id === studyStepIdMax) {
          return index;
        }
        current = nextMap.get(current.id);
        index++;
      }
      
      return null;
    },
    getWorkflowType(workflowId) {
        const workflow = this.$store.getters["table/workflow/get"](workflowId);
        return workflow ? workflow.name : "Unknown";
    },
    getUserName(userId) {
        const user = this.$store.getters["table/user/get"](userId);
        if (user) {
            return {
            firstName: user.firstName,
            lastName: user.lastName,
            };
        }
        return {
            firstName: "Unknown",
            lastName: "",
        };
    },
    open() {
      this.$refs.overviewModal.open();
    },
    close() {
      this.$refs.overviewModal.close();
    },
    handleAction({ action, params }) {
      if (action === "openSession") {
        this.openSession(params);
      }
    },
    openSession(session) {
      if (session.hash) {
        this.$router.push("/study/" + session.hash);
      }
    },
  },
};
</script>

<style scoped>
.modal-title {
  font-weight: bold;
}

.filters-container {
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 0.25rem;
}
</style>
