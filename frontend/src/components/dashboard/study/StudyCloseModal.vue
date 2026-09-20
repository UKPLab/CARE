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
        <i18n-t
          keypath="studies.closeModal.confirm"
          tag="p"
        >
          <template #name>
            <strong v-if="studyName">"{{ studyName }}"</strong>
            <span v-else>?</span>
          </template>
        </i18n-t>
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
        <BasicButton
          class="btn btn-secondary"
          :text="$t('common.cancel')"
          @click="onCancel"
        />
        <BasicButton
          class="btn btn-primary"
          :text="$t('studies.closeModal.closeStudy')"
          @click="onConfirm"
        />
      </div>
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import { resolveApiMessage } from "@/assets/utils";
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

