<template>
  <BasicCoordinator
      ref="coordinator"
      table="study"
      :title="isTemplateMode ? 'Template' : 'Study'"
      :textAdd="isTemplateMode ? 'Create' : 'Add'"
      :customSubmit="isTemplateMode"
      :defaultValue="{ isTemplateMode: isTemplateMode }"
      @success="success"
      @submit="handleSubmit"
  >
    <template #title>
      {{ modalTitle }}
    </template>
    <template #before-form="{ data }">
      <div
        v-if="!isTemplateMode && showPrivacyWarning(data)"
        class="alert alert-warning mb-3"
      >
        <strong><i class="bi bi-exclamation-triangle me-2"></i>Privacy Notice:</strong>
        <p class="mb-0 mt-2">
          You have selected email or document templates that may use participant names (username, first name, last name).
          If your study is not set to anonymize participants, these names will be visible in emails and documents.
          Consider enabling "Should the comments be anonymized?" to protect participant privacy.
        </p>
      </div>
    </template>
    <template #success>
      <div v-if="isTemplateMode">
        Template has been successfully created.
      </div>
      <div v-else>
        The study has been successfully published<br>
        Participants can join the study under the following link:<br><br>
        <a
            :href="link"
            target="_blank"
        >{{ link }}</a>
      </div>
    </template>
    <template v-if="isSuccess" #buttons>
      <button
          v-if="!isTemplateMode"
          class="btn btn-primary"
          @click="copyURL"
      >Copy Link
      </button>
    </template>
  </BasicCoordinator>
</template>

<script>
import BasicCoordinator from "@/basic/dashboard/Coordinator.vue";

/**
 * StudyCoordinator - coordinator to add or edit studies
 *
 * @author Dennis Zyska
 *
 */
export default {
  name: "CoordinatorStudy",
  subscribeTable: ['document', 'tag_set'],
  components: {BasicCoordinator},
  data() {
    return {
      studyId: 0,
      documentId: 0,
      isSuccess: false,
      isTemplateMode: false,
      isUsingTemplate: false,
    }
  },
  computed: {
    study() {
      if (this.studyId !== 0) {
        return {...this.$store.getters['table/study/get'](this.studyId)};
      }
      return {};
    },
    link() {
      return window.location.origin + "/study/" + this.study.hash;
    },
    modalTitle() {
      const prefix = this.isUsingTemplate ? 'Create' : (this.studyId !== 0 ? 'Edit' : 'New');
      const suffix = this.isTemplateMode ? 'Template' : 'Study';
      return `${prefix} ${suffix}`;
    },
  },
  methods: {
    /**
     * Check if privacy warning should be shown
     * Shows warning if templates are selected and anonymize is false
     * @param {Object} data - Study form data
     * @returns {boolean} True if warning should be shown
     */
    showPrivacyWarning(data) {
      if (!data) return false;
      
      // Check if anonymize is false (or not set, defaults to false)
      const anonymize = data.anonymize === true;
      if (anonymize) return false; // No warning if anonymization is enabled
      
      // Check if any study-related templates are selected
      // Type 2: Email - Study Session (emailTemplateStartId, emailTemplateFinishId)
      // Type 5: Document - Study (documentTemplateId)
      const hasEmailTemplate = (data.emailTemplateStartId && data.emailTemplateStartId !== 0) ||
                                (data.emailTemplateFinishId && data.emailTemplateFinishId !== 0);
      const hasDocumentTemplate = data.documentTemplateId && data.documentTemplateId !== 0;
      
      return hasEmailTemplate || hasDocumentTemplate;
    },
    open(studyId, documentId = null, loadInitialized = false, templateMode = false, copy = false) {
      if (documentId !== null) {
        this.documentId = documentId;
      }
      this.isSuccess = false;
      this.studyId = studyId;
      this.isTemplateMode = templateMode;
      this.isUsingTemplate = copy && studyId !== 0;
      this.hash = this.studyId !== 0 ? this.study.hash : this.hash;

      if (loadInitialized) {
        this.$refs.coordinator.showSuccess();
      }
      this.$refs.coordinator.open(studyId, {documentId: this.documentId, isTemplateMode: templateMode}, copy);
    },
    handleSubmit(data) {
      if (this.isTemplateMode) {
        this.$socket.emit("studySaveAsTemplate", {
          onlyTemplate: true,
          templateData: data
        }, (result) => {
          this.$refs.coordinator.$refs.coordinatorModal.waiting = false;
          if (!result.success) {
            this.eventBus.emit('toast', {
              title: "Template Creation Failed",
              message: result.message,
              variant: "danger",
            });
          } else {
            this.eventBus.emit('toast', {
              title: "Template Created",
              message: "The template has been created successfully.",
              variant: "success",
            });
            this.studyId = result.data;
            this.isSuccess = true;
            this.$refs.coordinator.showSuccess();
          }
        });
      }
    },
    success(id) {
      if (!this.isTemplateMode) {
        this.studyId = id;
        this.isSuccess = true;
      }
    },
    close() {
      this.$refs.coordinator.close();
    },
    async copyURL() {
      try {
        await navigator.clipboard.writeText(this.link);
        this.eventBus.emit('toast', {
          title: "Link copied",
          message: "Document link copied to clipboard!",
          variant: "success"
        });
      } catch ($e) {
        this.eventBus.emit('toast', {
          title: "Link not copied",
          message: "Could not copy document link to clipboard!",
          variant: "danger"
        });
      }
    }
  }
}
</script>


<style scoped>

</style>