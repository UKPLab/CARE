<template>
  <BasicModal
    ref="bulkCloseModal"
    name="bulk-close-modal"
  >
    <template #title>
      <span>Bulk Close Studies</span>
    </template>
    <template #body>
      <div>
        <p>
          Are you sure you want to close all open studies?
        </p>
      </div>
    </template>

    <template #footer>
      <div>
        <BasicButton
          title="Close All Studies"
          class="btn btn-primary"
          @click="closeAllStudies"
        />
      </div>
    </template>

  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";

/**
 * Modal for bulk closing studies
 * @author: Dennis Zyska
 */
export default {
  name: "BulkCloseModal",
  components: {
    BasicModal,
    BasicButton,
  },
  computed:{
    projectId() {
      return this.$store.getters["settings/getValueAsInt"]("projects.default");
    }
  },
  methods: {
    open() {
      this.$refs.bulkCloseModal.open();
    },
    closeAllStudies() {
      const data = {
        projectId: this.projectId,
        ignoreClosedState: false,
        progressId: this.$refs.bulkCloseModal.getProgressId(),
      };
      this.$refs.bulkCloseModal.startProgress();
      this.$socket.emit("studyCloseBulk", data, (res) => {
        this.$refs.bulkCloseModal.stopProgress();
        if (res.success) {
          this.eventBus.emit("toast", {
            title: "All studies closed",
            message: "All open studies have been closed",
            variant: "success",
          });
          this.$refs.bulkCloseModal.close();
        } else {
          this.eventBus.emit("toast", {
            title: "Failed to close all studies",
            message: res.message,
            variant: "danger",
          });
        }
      });
    },
  },

};
</script>

<style scoped>
</style>
