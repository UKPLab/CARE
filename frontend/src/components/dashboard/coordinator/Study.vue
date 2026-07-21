<template>
  <BasicCoordinator
      ref="coordinator"
      table="study"
      :title="isTemplateMode ? 'Template' : 'Study'"
      :text-add="isTemplateMode ? 'Create' : 'Add'"
      :custom-submit="isTemplateMode"
      :default-value="{ isTemplateMode: isTemplateMode }"
      @success="success"
      @submit="handleSubmit"
  >
    <template #title>
      {{ modalTitle }}
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
      <BasicButton
          v-if="!isTemplateMode"
          class="btn btn-primary"
          text="Copy Link"
          @click="copyURL"
      />
    </template>
  </BasicCoordinator>
</template>

<script>
import BasicCoordinator from "@/basic/dashboard/Coordinator.vue";
import BasicButton from "@/basic/Button.vue";

/**
 * StudyCoordinator - coordinator to add or edit studies
 *
 * @author Dennis Zyska
 *
 */
export default {
  name: "CoordinatorStudy",
  subscribeTable: ['document', 'tag_set', 'ai_budget'],
  components: {BasicCoordinator, BasicButton},
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

      // Pre-fill the three study-level cap virtual fields from ai_budget.
      const aiOverrides = studyId !== 0 ? this.findExistingStudyCaps(studyId) : {};

      this.$refs.coordinator.open(
          studyId,
          {documentId: this.documentId, isTemplateMode: templateMode},
          copy,
          aiOverrides
      );
    },
    findExistingStudyCaps(studyId) {
      const getter = this.$store.getters["table/ai_budget/getFiltered"];
      if (!getter) return {};
      const rows = getter(
        (b) => !b.deleted && Number(b.studyId) === Number(studyId) && !b.studyStepId
      );
      const out = {};
      for (const row of rows) {
        const value = Number(row.costLimit);
        if (!Number.isFinite(value)) continue;
        if (Number(row.limitType) === 0) out.aiCostLimitTotal = value;
        if (Number(row.limitType) === 1) out.aiCostLimitPerSession = value;
        if (Number(row.limitType) === 2) out.aiCostLimitPerUser = value;
      }
      return out;
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
        const originalStudy = this.$store.getters['table/study/get'](this.studyId);
        const newStudies = this.$store.getters['table/study/getFiltered']((s) => s.parentStudyId === originalStudy?.id);
        const validNewStudy = newStudies.find(s => new Date(s.createdAt) > new Date(originalStudy.createdAt));
        this.studyId = validNewStudy ? validNewStudy.id : id;
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
      } catch (_error) {
        this.eventBus.emit('toast', {
          title: "Link not copied",
          message: "Could not copy document link to clipboard!",
          variant: "danger"
        });
      }
    },
  }
}
</script>


<style scoped>

</style>
