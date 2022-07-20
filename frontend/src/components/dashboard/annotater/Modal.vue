<template>
  <div id="Modal" ref="Modal" aria-hidden="true" aria-labelledby="ModalLabel" class="modal fade"
       data-bs-backdrop="static"
       role="dialog" tabindex="-1">
    <div class="modal-dialog" role="document">
      <div class="modal-content">
        <div class="modal-header">
          <h5 id="ModalLabel" class="modal-title">
            <slot name="title"></slot>
          </h5>
          <button aria-label="Close" class="close" data-bs-dismiss="modal" type="button">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <div class="modal-body justify-content-center flex-grow-1 d-flex">
           <slot name="body"></slot>
        </div>
        <div class="modal-footer">
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