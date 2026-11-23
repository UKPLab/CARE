<template>
  <StepperModal
      ref="exportStepper"
      :steps="steps"
      :validation="stepValid"
      :submit-text="$t('common.download')"
      size = "xl"
      @submit="downloadData"
      @hide="hide">
    <template #title>
      <h5 class="modal-title">{{ $t('dashboard.projects.exportData') }}</h5>
    </template>

    <template #step-1>
      <BasicForm
          ref="dataSelectionForm"
          v-model="dataSelection"
          :fields="dataSelectionFields"
      />
    </template>

    <template #step-2>
      <div v-if="wizardExportTypes.includes(dataSelection.exportType)">
        <StepSelectUsers
          v-if="dataSelection.projectId"
          v-model="userSelection"
          :project-id="dataSelection.projectId"
          :export-type="dataSelection.exportType"
        />
        <!-- We send the project ID and get the selected users back -->
      </div>
      <StepProjectExport
        v-else
        ref="projectExport"
        :project-id="dataSelection.projectId"
        :export-type="dataSelection.exportType"
      />
    </template>


    <template #step-3>
      <StepOptions
        v-if="wizardExportTypes.includes(dataSelection.exportType)"
        v-model:generate-aliases="generateAliases"
        v-model:faker-seed="fakerSeed"
        v-model:grade-format="gradeFormat"
        v-model:merge-csv-files="mergeCsvFiles"
        :show-grade-format="dataSelection.exportType === 'grades'"
      />
      <!-- We get the info back if user wants to generate aliases and the seed that should be used for this -->
      <div v-if="['documents'].includes(dataSelection.exportType)">
        <StepOptionsDocuments
          v-model:selected-types="selectedDocumentTypes"
          v-model:exclude-non-consenting-edits="excludeNonConsentingEdits"
          v-model:exclude-non-consenting-annotations="excludeNonConsentingAnnotations"
        />
        <!-- We get the desired document types as well as if non consenting users' edits should be included  -->
      </div>
      <div v-else-if="['studies'].includes(dataSelection.exportType)">
        <StepOptionsStudies
          v-model:selected-workflow-ids="selectedWorkflowIds"
          v-model:include-empty-studies="includeEmptyStudies"
          v-model:include-document-files="includeStudyDocumentFiles"
          v-model:include-scores="includeStudyGrades"
          v-model:include-ai-scores="includeStudyIncludeAiScores"
          v-model:exclude-non-consenting-edits="excludeNonConsentingEdits"
          v-model:exclude-non-consenting-annotations="excludeNonConsentingAnnotations"
          :project-id="dataSelection.projectId"
        />
      </div>
      <div v-else-if="['userBehaviour'].includes(dataSelection.exportType)">
        <StepOptionsUserBehaviour
          v-model:output-format="behaviourOutputFormat"
          v-model:file-format="behaviourFileFormat"
        />
      </div>
    </template>

    <template 
      v-if="wizardExportTypes.includes(dataSelection.exportType)"
      #step-4
    >
      <StepConfirmDownload
        ref="confirmDownload"
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
import StepSelectUsers from "@/components/dashboard/projects/export/StepSelectUsers.vue";
import StepOptions from "@/components/dashboard/projects/export/StepOptions.vue";
import StepOptionsDocuments from "@/components/dashboard/projects/export/StepOptionsDocuments.vue";
import StepOptionsStudies from "@/components/dashboard/projects/export/StepOptionsStudies.vue";
import StepOptionsUserBehaviour from "@/components/dashboard/projects/export/StepOptionsUserBehaviour.vue";
import StepConfirmDownload from "@/components/dashboard/projects/export/StepConfirmDownload.vue";
import StepProjectExport from "@/components/dashboard/projects/export/StepProjectExport.vue";

// Export types that go through the full wizard (select users, options, confirm download)
// rather than the plain "select project" flow (reviewerList, all).
const WIZARD_EXPORT_TYPES = ['submissions', 'grades', 'documents', 'studies', 'userBehaviour'];

/**
 * User selection and wizard options, reset whenever the project or export type changes.
 * @returns {Object} Fresh default values (new arrays on every call)
 */
function exportOptionDefaults() {
  return {
    userSelection: [],
    generateAliases: false,
    fakerSeed: 846569412,
    gradeFormat: "json",
    mergeCsvFiles: false,
    selectedDocumentTypes: [0, 1, 2, 4],
    excludeNonConsentingEdits: false,
    excludeNonConsentingAnnotations: false,
    selectedWorkflowIds: [],
    includeStudyDocumentFiles: true,
    includeStudyGrades: true,
    includeStudyIncludeAiScores: true,
    includeEmptyStudies: true,
    behaviourOutputFormat: 'single',
    behaviourFileFormat: 'json',
  };
}

/**
 * ProjectModal - modal component for adding and editing projects
 *
 * @author Dennis Zyska, Mélissa Loew
 */
export default {
  name: "ExportProjectModal",
  components: { StepperModal, BasicForm, StepSelectUsers, StepOptions, StepOptionsDocuments, StepOptionsStudies, StepOptionsUserBehaviour, StepConfirmDownload, StepProjectExport },
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
    table: "tag"
  }, {
      table: "document_data",
  }, {
      table: "study_step",
  }, {
      table: "configuration",
  }, {
      table: "workflow",
  }, {
    table: "user_role",
  }, {
      table: "user_role_matching",
  }
  ],
  provide() {
    return {
      exportStepper: computed(() => this.$refs.exportStepper),
    }
  },
  data() {
    return {
      wizardExportTypes: WIZARD_EXPORT_TYPES,
      dataSelection: {
        projectId: null,
        exportType: "reviewerList",
      },
      ...exportOptionDefaults(),
    };
  },
  computed: {
    stepValid() {
      const settingsValid = !!this.dataSelection.projectId && !!this.dataSelection.exportType;
      if (!this.wizardExportTypes.includes(this.dataSelection.exportType)) {
        return [settingsValid, true];
      }
      // The options step only has required choices for documents and studies.
      const optionsValid = {
        documents: this.selectedDocumentTypes.length > 0,
        studies: this.selectedWorkflowIds.length > 0,
      }[this.dataSelection.exportType] ?? true;
      return [settingsValid, this.userSelection.length > 0, optionsValid, true];
    },
    /**
     * Form fields posted to /export/stream for the wizard export types: the common
     * selection (project, users, aliases) plus the options of the chosen export type.
     */
    streamPayload() {
      const exportType = this.dataSelection.exportType;
      const typeOptions = {
        grades: {
          gradeFormat: this.gradeFormat,
          mergeCsvFiles: this.gradeFormat === "csv" ? this.mergeCsvFiles : false
        },
        documents: {
          documentTypes: this.selectedDocumentTypes,
          excludeNonConsentingEdits: this.excludeNonConsentingEdits,
          excludeNonConsentingAnnotations: this.excludeNonConsentingAnnotations
        },
        studies: {
          workflowIds: this.selectedWorkflowIds,
          includeEmptyStudies: this.includeEmptyStudies,
          includeDocumentFiles: this.includeStudyDocumentFiles,
          includeGrades: this.includeStudyGrades,
          excludeNonConsentingEdits: this.excludeNonConsentingEdits,
          excludeNonConsentingAnnotations: this.excludeNonConsentingAnnotations,
          includeAiScores: this.includeStudyIncludeAiScores
        },
        userBehaviour: {
          behaviourOutputFormat: this.behaviourOutputFormat,
          behaviourFileFormat: this.behaviourFileFormat
        },
      }[exportType] || {};
      return {
        projectId: this.dataSelection.projectId,
        exportType,
        userIds: this.userSelection.map(row => row.userId),
        generateAliases: this.generateAliases,
        fakerSeed: this.generateAliases ? this.fakerSeed : null,
        ...typeOptions
      };
    },
    steps() {
      if (this.wizardExportTypes.includes(this.dataSelection.exportType)) {
        return [
          { title: this.$t('settings.title') },
          { title: this.$t('dashboard.projects.exportModal.steps.selectStudent') },
          { title: this.$t('dashboard.projects.exportModal.steps.options') },
          { title: this.$t('dashboard.projects.exportModal.steps.confirmDownload') }
        ];
      }

      return [
        {title: this.$t('settings.title')},
        {title: this.$t('dashboard.projects.exportModal.steps.confirmation')}
      ];
    },
    dataSelectionFields() {
      return [
        {
          key: "projectId",
          label: this.$t('common.project'),
          type: "select",
          options: this.projects.map(project => ({
            name: project.name,
            value: project.id,
          })),
          required: true,
        },
        {
          key: "exportType",
          label: this.$t('dashboard.projects.exportType'),
          type: "select",
          options: [
            {name: this.$t('dashboard.projects.exportModal.exportReviewers'), value: "reviewerList"},
            {name: this.$t('dashboard.projects.exportModal.exportSubmissions'), value: "submissions"},
            {name: this.$t('dashboard.projects.exportModal.exportGrades'), value: "grades"},
            {name: this.$t('dashboard.projects.exportModal.exportDocuments'), value: "documents"},
            {name: this.$t('dashboard.projects.exportModal.exportStudies'), value: "studies"},
            ...(this.$store.getters["auth/isAdmin"] ? [{name: this.$t('dashboard.projects.exportModal.exportUserBehaviour'), value: "userBehaviour"}] : []),
            {name: this.$t('common.all'), value: "all"},
          ],
          required: true,
        }
      ]
    },
    projects() {
      return this.$store.getters["table/project/getAll"];
    },
  },
  watch: {
    'dataSelection.exportType'() {
      this.resetOptions();
    },
    'dataSelection.projectId'() {
      this.resetOptions();
    }
  },
  methods: {
    resetOptions() {
      Object.assign(this, exportOptionDefaults());
    },
    open(projectId) {
      this.dataSelection.projectId = projectId;
      this.$refs.exportStepper.open();
    },
    hide() {
      this.resetOptions();
    },
    async downloadData() {
      if (!this.wizardExportTypes.includes(this.dataSelection.exportType)) {
        await this.$refs.projectExport.download();
        this.$refs.exportStepper.close();
        return;
      }
      try {
        this.$refs.confirmDownload.download(this.streamPayload);
        this.$refs.exportStepper.close();
      } catch (error) {
        console.error("Streaming error:", error);
        this.$toast.error(this.$t('dashboard.projects.export.streamError'));
      }
    },
  }
}
</script>

<style scoped>

</style>
