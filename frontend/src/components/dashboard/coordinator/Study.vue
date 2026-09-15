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
      @hide="dropFormData"
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
  emits: ["published"],
  components: {BasicCoordinator, BasicButton},
  data() {
    return {
      studyId: 0,
      documentId: 0,
      isSuccess: false,
      isTemplateMode: false,
      isUsingTemplate: false,
      studyRecord: null,
      formSubscriptionIds: [],
    }
  },
  computed: {
    study() {
      if (this.studyRecord && Number(this.studyRecord.id) === Number(this.studyId)) {
        return { ...this.studyRecord };
      }
      if (this.studyId !== 0) {
        const fromStore = this.$store.getters["table/study/get"](this.studyId);
        if (fromStore) {
          return { ...fromStore };
        }
      }
      return this.studyRecord ? { ...this.studyRecord } : {};
    },
    link() {
      if (!this.study.hash) {
        return "";
      }
      return window.location.origin + "/study/" + this.study.hash;
    },
    modalTitle() {
      const prefix = this.isUsingTemplate ? 'Create' : (this.studyId !== 0 ? 'Edit' : 'New');
      const suffix = this.isTemplateMode ? 'Template' : 'Study';
      return `${prefix} ${suffix}`;
    },
  },
  methods: {
    subscribeAppData(payload) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Timed out loading form data")), 20000);
        this.$socket.emit("subscribeAppData", payload, (result) => {
          clearTimeout(timer);
          if (result?.success) {
            this.formSubscriptionIds.push(result.data);
            if (Array.isArray(this.subscriptionIds)) {
              this.subscriptionIds.push(result.data);
            }
            resolve(result.data);
          } else {
            reject(new Error(result?.message || "Failed to load form data"));
          }
        });
      });
    },
    loadFormData(studyId) {
      const waits = [
        this.subscribeAppData({table: "document"}),
        this.subscribeAppData({table: "tag_set"}),
      ];
      if (studyId) {
        waits.push(this.subscribeAppData({
          table: "study_step",
          filter: [{key: "studyId", value: Number(studyId)}],
        }));
      }
      return Promise.all(waits);
    },
    async open(studyId, documentId = null, loadInitialized = false, templateMode = false, copy = false, studyRow = null) {
      if (documentId !== null) {
        this.documentId = documentId;
      }
      this.isSuccess = false;
      this.studyId = studyId;
      this.isTemplateMode = templateMode;
      this.isUsingTemplate = copy && studyId !== 0;
      this.studyRecord = studyRow ? { ...studyRow } : null;
      this.hash = this.studyId !== 0 ? this.study.hash : this.hash;

      if (!loadInitialized) {
        try {
          await this.loadFormData(studyId);
          await this.$nextTick();
        } catch (err) {
          this.eventBus.emit("toast", {
            title: "Could not load study form",
            message: err.message,
            variant: "danger",
          });
          return;
        }
      }

      if (loadInitialized) {
        this.$refs.coordinator.showSuccess();
      }
      this.$refs.coordinator.open(
        studyId,
        {documentId: this.documentId, isTemplateMode: templateMode},
        copy,
        {},
        this.studyRecord
      );
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
    success(payload) {
      if (!this.isTemplateMode) {
        const published = payload && typeof payload === "object"
          ? payload
          : {id: payload};
        if (published.hash) {
          this.studyId = published.id;
          this.studyRecord = {
            ...(this.studyRecord || {}),
            id: published.id,
            hash: published.hash,
          };
        } else if (published.id) {
          this.studyId = published.id;
          if (!this.studyRecord || Number(this.studyRecord.id) !== Number(published.id)) {
            this.studyRecord = {id: published.id};
          }
        }
        this.isSuccess = true;
        this.$emit("published", published);
      }
    },
    dropFormData() {
      const ids = [...this.formSubscriptionIds];
      this.formSubscriptionIds = [];
      ids.forEach((id) => {
        this.$socket.emit("unsubscribeAppData", id);
        const list = this.subscriptionIds;
        if (Array.isArray(list)) {
          const index = list.indexOf(id);
          if (index >= 0) {
            list.splice(index, 1);
          }
        }
      });
      if (!this.studyId) {
        return;
      }
      const steps = this.$store.getters["table/study_step/getFiltered"](
        (step) => Number(step.studyId) === Number(this.studyId)
      ) || [];
      if (steps.length) {
        this.$store.commit(
          "table/study_step/SOCKET_study_stepRefresh",
          steps.map((step) => ({id: step.id, deleted: true}))
        );
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
    }
  }
}
</script>


<style scoped>

</style>