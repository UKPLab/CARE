<template>
  <Modal ref="exportModal" title="Export Project">
    <template #body>
      <div>
        Do you really want to export the project? <br>
      </div>
    </template>

    <template #footer>
      <span class="btn-group">
        <BasicButton
          class="btn btn-secondary"
          title="Abort"
          @click="close"
        />
        <BasicButton
          class="btn btn-primary me-2"
          title="Yes, export it!"
          @click="downloadData"
        />
      </span>
    </template>

  </Modal>
</template>

<script>

import Modal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";

/**
 * ProjectModal - modal component for adding and editing projects
 *
 * @author Dennis Zyska
 */
export default {
  name: "ExportProjectModal",
  components: {Modal, BasicButton},
  data() {
    return {
      projectId: 0,
    }
  },
  methods: {
    open(projectId) {
      this.projectId = projectId;
      this.$refs.exportModal.open();
    },
    close() {
      this.$refs.exportModal.close();
    },
    downloadData() {
      console.log("Download data");
    }
  }
}
</script>

<style scoped>

</style>