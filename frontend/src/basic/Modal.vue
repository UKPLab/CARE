<template>
  <div ref="Modal" aria-hidden="true" aria-labelledby="ModalLabel" class="modal fade"
       data-bs-backdrop="static"
       role="dialog" tabindex="-1">
    <div class="modal-dialog" :class="xl && 'modal-xl' || lg && 'modal-lg'" role="document">
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
/* Modal.vue - default modal component

Provide a default modal component to include modals into other components

Author: Dennis Zyska (zyska@ukp...)
Source: -
*/
import {Modal} from 'bootstrap';

export default {
  name: "Modal",
  props: {
    xl: {
      type: Boolean,
      required: false,
      default: false,
    },
    lg: {
      type: Boolean,
      required: false,
      default: false,
    },
    open: {
      type: Boolean,
      required: false,
      default: false,
    }
  },
  data() {
    return {
      modal: null,
      waiting: false,
    }
  },
  mounted() {
    this.modal = new Modal(this.$refs.Modal);
    if (this.open) {
      this.openModal();
    }
  },
  methods: {
    openModal() {
      this.waiting = false;
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