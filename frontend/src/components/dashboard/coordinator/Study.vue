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
    <template #success>
      The study has been successfully published<br>
      Participants can join the study under the following link:<br><br>
      <a
          :href="link"
          target="_blank"
      >{{ link }}</a>
    </template>
    <template v-if="isSuccess" #buttons>
      <button
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
      this.$refs.coordinator.open(studyId, {documentId: this.documentId, isTemplateMode: this.isTemplateMode},copy);
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