<template>
  <div ref="Modal" aria-hidden="true" aria-labelledby="ModalLabel" class="modal fade"
       data-bs-backdrop="static"
       role="dialog" tabindex="-1">
    <div class="modal-dialog" role="document">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">
            <slot name="title"></slot>
          </h5>
          <button aria-label="Close" class="close" data-bs-dismiss="modal" type="button">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <div class="modal-body">
          <div v-if="waiting" class="justify-content-center flex-grow-1 d-flex" role="status">
            <div class="spinner-border m-5">
              <span class="visually-hidden">Loading...</span>
            </div>
          </div>
          <div v-else>
            <slot name="body"></slot>
          </div>
        </div>
        <div v-if="!waiting" class="modal-footer">
          <slot name="footer"></slot>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {Modal} from 'bootstrap';

export default {
  name: "Modal",
  data() {
    return {
      modal: null,
      waiting: false,
    }
  },
  mounted() {
    this.modal = new Modal(this.$refs.Modal);
  },
  methods: {
    openModal() {
      this.modal.show();
    },
    closeModal() {
      this.modal.hide();
    }
  }
}
</script>

<style scoped>

</style>