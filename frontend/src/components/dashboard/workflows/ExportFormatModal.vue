<template>
  <BasicModal
    ref="modal"
    size="md"
    name="ExportFormatModal"
  >
    <template #title>
      Export Workflows
    </template>
    <template #body>
      <div class="d-grid gap-2">
        <BasicButton
          class="btn btn-outline-primary"
            title="JSON Format"
            iconName="filetype-json"
          @click="selectFormat('json')"
        >
          <LoadIcon icon-name="filetype-json" class="me-2" />
          JSON Format
          <small class="d-block text-muted">Standard JSON format with proper formatting</small>
        </BasicButton>
        <BasicButton
          class="btn btn-outline-primary"
          title="YAML Format"
          iconName="filetype-yml"
          @click="selectFormat('yaml')"
        >
          <LoadIcon icon-name="filetype-yml" class="me-2" />
          YAML Format  
          <small class="d-block text-muted">Human-readable YAML format</small>
        </BasicButton>
      </div>
    </template>
    <template #footer>
      <BasicButton
        class="btn btn-secondary"
        title="Cancel"
        @click="close()"
      />
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import LoadIcon from "@/basic/Icon.vue";

export default {
  name: "ExportFormatModal",
  components: { BasicModal, BasicButton, LoadIcon },
  emits: ['formatSelected'],
  methods: {
    open() {
      this.$refs.modal.open();
    },
    close() {
      this.$refs.modal.close();
    },
    selectFormat(format) {
      this.close();
      this.$emit('formatSelected', format);
    }
  }
}
</script>

<style scoped>
.btn small {
  font-size: 0.75rem;
  margin-top: 0.25rem;
}
</style>