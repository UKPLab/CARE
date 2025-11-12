<template>
  <BasicModal
      ref="modal"
      name="StudyLoadingModal"
      :disable-keyboard="true"
      :remove-close="true"
      :auto-open="true"
  >
    <template #body>
      <div class="d-flex justify-content-center align-items-center" style="height: 200px;">
        <div class="spinner-border" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <span class="ms-3">Loading, please wait...</span>
      </div>
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";

export default {
  name: "LoadingModal",
  components: {BasicModal}
}
</script>

<style scoped>

</style>