<template>
  <BasicModal
    ref="closeModal"
    name="study-close-modal"
  >
    <template #title>
      <span>Close Study</span>
    </template>
    <template #body>
      <div>
        <p>
          Are you sure you want to close the study
          <strong v-if="studyName">"{{ studyName }}"</strong>
          <span v-else>?</span>
        </p>
        <div class="form-check mt-3">
          <input
            id="notifySessionsCheckbox"
            v-model="notifySessions"
            class="form-check-input"
            type="checkbox"
          >
          <label
            class="form-check-label"
            for="notifySessionsCheckbox"
          >
            Send email notification to participants with open sessions
          </label>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="btn-group">
        <BasicButton
          class="btn-secondary"
          text="Cancel"
          @click="onCancel"
        />
        <BasicButton
          class="btn-primary"
          text="Close study"
          @click="onConfirm"
        />
      </div>
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";

export default {
  name: "StudyCloseModal",
  components: { BasicModal, BasicButton },
  data() {
    return {
      studyId: null,
      studyName: "",
      notifySessions: false,
    };
  },
  methods: {
    open(study) {
      this.studyId = study?.id ?? null;
      this.studyName = study?.name ?? "";
      this.notifySessions = false;
      this.$refs.closeModal.open();
    },
    onCancel() {
      this.$refs.closeModal.close();
    },
    onConfirm() {
      if (!this.studyId) {
        this.$refs.closeModal.close();
        return;
      }
      this.$socket.emit(
        "studyClose",
        {
          studyId: this.studyId,
          notifySessions: this.notifySessions,
        },
        (result) => {
          if (result.success) {
            this.eventBus.emit("toast", {
              title: "Study closed",
              message: "The study has been closed",
              variant: "success",
            });
            this.$refs.closeModal.close();
          } else {
            this.eventBus.emit("toast", {
              title: "Study closing failed",
              message: result.message,
              variant: "danger",
            });
          }
        }
      );
    },
  },
};
</script>

<style scoped>
.form-check-label {
  cursor: pointer;
}
</style>

