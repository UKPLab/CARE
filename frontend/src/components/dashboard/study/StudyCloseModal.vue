<template>
  <BasicModal
    ref="closeModal"
    name="study-close-modal"
  >
    <template #title>
      <span>{{ $t("studies.closeModal.title") }}</span>
    </template>
    <template #body>
      <div>
        <p>
          {{ $t("studies.closeModal.confirmPrefix") }}
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
            {{ $t("studies.closeModal.notifySessions") }}
          </label>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="btn-group">
        <button
          type="button"
          class="btn btn-secondary"
          @click="onCancel"
        >
          {{ $t("common.cancel") }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          @click="onConfirm"
        >
          {{ $t("studies.closeModal.closeStudy") }}
        </button>
      </div>
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import { resolveApiMessage } from "@/assets/utils";

export default {
  name: "StudyCloseModal",
  components: { BasicModal },
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
              title: this.$t("studies.closeModal.success.title"),
              message: this.$t("studies.closeModal.success.message"),
              variant: "success",
            });
            this.$refs.closeModal.close();
          } else {
            this.eventBus.emit("toast", {
              title: this.$t("studies.closeModal.errors.title"),
              message: resolveApiMessage(result),
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

