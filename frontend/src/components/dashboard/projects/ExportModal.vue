<template>
  <StepperModal
      ref="exportStepper"
      :steps="steps"
      :validation="stepValid"
      submit-text="Download"
      size = "xl"
      @submit="downloadData"
      @hide="hide">
    <template #title>
      <h5 class="modal-title">Export Data</h5>
    </template>

    <template #step-1>
      <BasicForm
          ref="dataSelectionForm"
          v-model="dataSelection"
          :fields="dataSelectionFields"
      />
    </template>

    <template #step-2>

      <div v-if="dataSelection.exportType === 'reviewerList'">
        <p>Exporting a list of all study sessions with hash:</p>
        <p>
          Total Studies: {{ studies.length }}<br>
          Total Study Sessions: {{ studySessions.length }}
        </p>
      </div>
      <div v-else>
        <StepSelectUsers
          v-if="dataSelection.projectId"
          :project-id="dataSelection.projectId"
          :export-type="dataSelection.exportType"
          v-model="userSelection"
        />
        <!-- We send the project ID and get the selected users back -->
      </div>
    </template>

    
    <template #step-3>
      <div v-if="['submissions', 'grades'].includes(dataSelection.exportType)">
        <StepOptions
          v-model:generateAliases="generateAliases"
          v-model:fakerSeed="fakerSeed"
          v-model:grade-format="gradeFormat"
          :show-grade-format="dataSelection.exportType === 'grades'"
        />
        <!-- We get the info back if user wants to generate aliases and the seed that should be used for this -->
      </div>
      <div v-else-if="['documents'].includes(dataSelection.exportType)">
        <StepOptionsDocuments
          v-model:selectedTypes="selectedDocumentTypes"
          v-model:excludeNonConsentingEdits="excludeNonConsentingEdits"
          v-model:excludeNonConsentingAnnotations="excludeNonConsentingAnnotations"
        />
        <!-- We get the desired document types as well as if non consenting users' edits should be included  -->
      </div>
      <div v-else-if="['studies'].includes(dataSelection.exportType)">
        <StepOptionsStudies
          :project-id="dataSelection.projectId"
          v-model:selectedWorkflowIds="selectedWorkflowIds"
          v-model:includeEmptyStudies="includeEmptyStudies"
          v-model:excludeNonConsentingEdits="excludeNonConsentingEdits"
          v-model:excludeNonConsentingAnnotations="excludeNonConsentingAnnotations"
        />
      </div>
    </template>

    <template 
      v-if="['submissions', 'grades', 'documents', 'studies'].includes(dataSelection.exportType)"
      #step-4
    >
      <StepConfirmDownload
        :wait="wait"
        :generate-aliases="generateAliases"
        :user-selection="userSelection"
        :export-type="dataSelection.exportType"
      />
    </template>
  </StepperModal>
</template>

<script>
import BasicForm from "@/basic/Form.vue";
import StepperModal from "@/basic/modal/StepperModal.vue";
import {computed} from "vue";
import {downloadObjectsAs} from "@/assets/utils";
import BasicLoading from "@/basic/Loading.vue";
import StepSelectUsers from "@/components/dashboard/projects/export/StepSelectUsers.vue";
import StepOptions from "@/components/dashboard/projects/export/StepOptions.vue";
import StepOptionsDocuments from "@/components/dashboard/projects/export/StepOptionsDocuments.vue";
import StepOptionsStudies from "@/components/dashboard/projects/export/StepOptionsStudies.vue";
import StepConfirmDownload from "@/components/dashboard/projects/export/StepConfirmDownload.vue";
import getServerURL from "@/assets/serverUrl.js";


/**
 * ProjectModal - modal component for adding and editing projects
 *
 * @author Dennis Zyska, Mélissa Loew
 */
export default {
  name: "ExportProjectModal",
  components: { BasicLoading, StepperModal, BasicForm, StepSelectUsers, StepOptions, StepOptionsDocuments, StepOptionsStudies, StepConfirmDownload },
  subscribeTable: [{
    table: "document",
  }, {
    table: "user",
    include: [{
      table: "study_session",
      by: "userId",
      type: "count",
      as: "studySessions"
    }]
  }, {
    table: "study",
  }, {
    table: "study_session",
  }, {
    table: "tag_set",
  }, {
    table: "tag",
  }, {
    table: "workflow",
  }
  ],
  provide() {
    return {
      exportStepper: computed(() => this.$refs.exportStepper),
    }
  },
  data() {
    return {
      dataSelection: {
        projectId: null,
        exportType: "reviewerList",
      },
      filter: [],
      wait: false,
      // Data for Export Submissions
      userSelection: [],
      generateAliases:false,
      fakerSeed: 846569412,
      gradeFormat: "json",
      selectedDocumentTypes: [0, 1, 2, 4],
      excludeNonConsentingEdits: false,
      excludeNonConsentingAnnotations: false,
      selectedWorkflowIds: [],
      includeEmptyStudies: false
    };
  },
  computed: {
    stepValid() {
      if (["submissions", "grades", "everything"].includes(this.dataSelection.exportType)) {
        return [
          !!this.dataSelection.projectId && !!this.dataSelection.exportType, // must select a valid project and export type 
          this.userSelection.length > 0, // must select at least one student
          true,
          true
        ];
      } else if (this.dataSelection.exportType === "documents") {
        return [
          !!this.dataSelection.projectId && !!this.dataSelection.exportType,
          this.userSelection.length > 0,
          this.selectedDocumentTypes.length > 0,
          true,
        ];
      } else if (this.dataSelection.exportType === 'studies') {
        return [
          !!this.dataSelection.projectId && !!this.dataSelection.exportType,
          this.userSelection.length > 0,
          true,
          true,
        ];
      }
      return [
        !!this.dataSelection.projectId && !!this.dataSelection.exportType,
        true
      ];
    },
    steps() {
      if (["submissions", "grades", "documents", "studies", "everything"].includes(this.dataSelection.exportType)) {
        return [
          { title: "Settings" },
          { title: "Select Users" },
          { title: "Options" },
          { title: "Confirm Download" }
        ];
      } 
      return [
        {title: "Settings"},
        {title: "Confirmation"}
      ];
    },
    dataSelectionFields() {
      return [
        {
          key: "projectId",
          label: "Project",
          type: "select",
          options: this.projects.map(project => ({
            name: project.name,
            value: project.id,
          })),
          required: true,
        },
        {
          key: "exportType",
          label: "Export Type",
          type: "select",
          options: [
            {name: "Export a list of all reviewers", value: "reviewerList"},
            {name: "Export submissions", value: "submissions"},
            {name: "Export grades", value: "grades"},
            {name: "Export documents", value:"documents"},
            {name: "Export studies", value: "studies"},
            {name: "Export everything", value: "everything"},
          ],
          required: true,
        }
      ]
    },
    studies() {
      return this.$store.getters["table/study/getFiltered"]((s) => s.projectId === this.dataSelection.projectId);
    },
    studySteps() {
      return this.$store.getters["table/study_step/getFiltered"]((s) => this.studies.map(study => study.id).includes(s.studyId));
    },
    studySessions() {
      return this.$store.getters["table/study_session/getFiltered"]((s) => this.studies.map(study => study.id).includes(s.studyId));
    },
    reviewerList() {
      return this.studySessions.map(session => {

        const study = this.$store.getters["table/study/get"](session.studyId);
        const studyUser = this.$store.getters["table/user/get"](study.userId);
        const studySessionUser = this.$store.getters["table/user/get"](session.userId);

        return {
          "studyUserName": studyUser.firstName + " " + studyUser.lastName,
          "studyUserFirstName": studyUser.firstName,
          "studyUserLastName": studyUser.lastName,
          "studySessionUserName": studySessionUser.firstName + " " + studySessionUser.lastName,
          "studySessionUserFirstName": studySessionUser.firstName,
          "studySessionUserLastName": studySessionUser.lastName,
          "studySessionHash": session.hash,
        }
      });
    },
    projects() {
      return this.$store.getters["table/project/getAll"];
    },
  },
  methods: {
    open(projectId) {
      this.dataSelection.projectId = projectId;
      this.$refs.exportStepper.open();
    },
    hide() {
      this.filter = [];
      this.userSelection = [];
      this.generateAliases = false;
      this.fakerSeed = 846569412;
      this.selectedDocumentTypes = [0, 1, 2, 4];
      this.excludeNonConsentingEdits = false;
      this.excludeNonConsentingAnnotations = false;
      this.selectedWorkflowIds = [];
      this.includeEmptyStudies = false;
      this.wait = false;
    },
    downloadData() {
      if (this.dataSelection.exportType === "reviewerList") {
        this.downloadReviewerList();
      } else if (this.dataSelection.exportType === "submissions") {
        this.downloadSubmissions();
      } else if (this.dataSelection.exportType === "grades") {
        this.downloadGrades();
      } else if (this.dataSelection.exportType === "documents") {
        this.downloadDocuments();
      } else if (this.dataSelection.exportType === 'studies') {
        this.downloadStudies();
      } else {
        this.downloadEverything();
      }
    },
    downloadReviewerList() {
      const filename = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + '_session_list';
      downloadObjectsAs(this.reviewerList, filename, "csv");
      this.$refs.exportStepper.close();
    },
    async downloadSubmissions() {
      try {
        // get the selected student's user ids
        const selectedUserIds = this.userSelection.map(row => row.userId);

        // call helper function to trigger the stream download
        this.triggerStreamDownload({
          projectId: this.dataSelection.projectId,
          exportType: 'submissions',
          userIds: selectedUserIds,
          generateAliases: this.generateAliases,
          fakerSeed: this.generateAliases ? this.fakerSeed : null
        });

        this.$refs.exportStepper.close();
      } catch (error) {
        console.error("Streaming error:", error);
        this.$toast.error("An error occurred starting the stream. Please try again.");
      }
    },
    async downloadGrades() {
      try {
        const selectedUserIds = this.submissionSelection.map(row => row.userId);
        this.triggerStreamDownload({
          projectId: this.dataSelection.projectId,
          exportType: 'grades',
          userIds: selectedUserIds,
          generateAliases: this.generateAliases,
          fakerSeed: this.generateAliases ? this.fakerSeed : null,
          gradeFormat: this.gradeFormat
        });
        this.$refs.exportStepper.close();
      } catch (error) {
        console.error("Streaming error:", error);
        this.$toast.error("An error occurred starting the stream. Please try again.");
      }
    },
    async downloadDocuments() {
      try {
        const selectedUserIds = this.userSelection.map(row => row.userId);
        this.triggerStreamDownload({
          projectId: this.dataSelection.projectId,
          exportType: 'documents',
          userIds: selectedUserIds,
          documentTypes: this.selectedDocumentTypes,
          excludeNonConsentingEdits: this.excludeNonConsentingEdits,
          excludeNonConsentingAnnotations: this.excludeNonConsentingAnnotations
        });

        this.$refs.exportStepper.close();
      } catch (error) {
          console.error("Streaming error:", error);
          this.$toast.error("An error occurred starting the stream. Please try again.");
      }
    },
    async downloadStudies() {
      try {
        const selectedUserIds = this.userSelection.map(row => row.userId);
        this.triggerStreamDownload({
          projectId: this.dataSelection.projectId,
          exportType: 'studies',
          userIds: selectedUserIds,
          workflowIds: this.selectedWorkflowIds,
          includeEmptyStudies: this.includeEmptyStudies,
          excludeNonConsentingEdits: this.excludeNonConsentingEdits,
          excludeNonConsentingAnnotations: this.excludeNonConsentingAnnotations
        });
        this.$refs.exportStepper.close();
      } catch (error) {
        console.error("Streaming error:", error);
        this.$toast.error("An error occurred starting the stream. Please try again.");
      }
    },
    async downloadEverything() {
      try {
        const selectedUserIds = this.userSelection.map(row => row.userId);
        this.triggerStreamDownload({
          projectId: this.dataSelection.projectId,
          exportType: 'everything',
          userIds: selectedUserIds,
        });
        this.$refs.exportStepper.close();
      } catch (error) {
        console.error("Streaming error:", error);
        this.$toast.error("An error occurred starting the stream. Please try again.");
      }
    },
    triggerStreamDownload(payload) {
      const serverUrl = getServerURL();
    
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = `${serverUrl}/export/stream`;
      form.style.display = 'none';

      for (const [key, value] of Object.entries(payload)) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        
        input.value = (typeof value === 'object' && value !== null) 
          ? JSON.stringify(value) 
          : value;
          
        form.appendChild(input);
      }

      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);
    }
  }
}
</script>

<style scoped>

</style>