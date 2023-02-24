<template>
  <div
    ref="Modal"
    aria-hidden="true"
    aria-labelledby="ModalLabel"
    class="modal fade"
    data-bs-backdrop="static"
    :data-bs-keyboard="!disableKeyboard"
    role="dialog"
    tabindex="-1"
  >
    <div
      class="modal-dialog"
      :class="xl && 'modal-xl' || lg && 'modal-lg'"
      role="document"
    >
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">
            <slot name="title" />
          </h5>
          <button
            v-if="!removeClose"
            type="button"
            class="btn-close"
            data-bs-dismiss="modal"
            aria-label="Close"
          />
        </div>
        <div class="modal-body">
          <div
            v-if="waiting"
            class="justify-content-center flex-grow-1 d-flex"
            role="status"
          >
            <div class="spinner-border m-5">
              <span class="visually-hidden">Loading...</span>
            </div>
          </div>
          <div v-else>
            <slot name="body" />
          </div>
        </div>
        <div
          v-if="!waiting"
          class="modal-footer"
        >
          <slot name="footer" />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
/* Modal.vue - default modal component

Provide a default modal component to include modals into other components.

Include, e.g. as:

  <Modal ref="testModal" name="test" lg />
  ...
  this.$refs.testModal.open();

Author: Dennis Zyska
Co-author: Nils Dycke
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
    autoOpen: {
      type: Boolean,
      required: false,
      default: false,
    },
    disableKeyboard: {
      type: Boolean,
      required: false,
      default: false
    },
    removeClose: {
      type: Boolean,
      required: false,
      default: false,
    },
    props: {
      type: Object,
      required: false
    },
    name: {
      type: String,
      required: true
    }
  },
  emits: ['show', 'hide'],
  data() {
    return {
      modal: null,
      waiting: false,
    }
  },
  mounted() {
    this.modal = new Modal(this.$refs.Modal);
    this.$refs.Modal.addEventListener('hide.bs.modal', this.hideEvent);
    this.$refs.Modal.addEventListener('show.bs.modal', this.showEvent);

    if (this.autoOpen) {
      this.openModal();
    }
  },
  beforeUnmount() {
    this.$refs.Modal.removeEventListener('hide.bs.modal', this.hideEvent);
    this.$refs.Modal.removeEventListener('show.bs.modal', this.showEvent);
    this.modal.hide();
  },
  methods: {
    hideEvent(event) {
      this.$emit('hide');
      this.$socket.emit("stats", {
        action: "hideModal",
        data: {"name": this.name, "props": this.props}
      });
    },
    showEvent(event) {
      this.$emit('show');
      this.$socket.emit("stats", {
        action: "openModal",
        data: {"name": this.name, "props": this.props}
      });
    },
    open() {
      this.openModal();
    },
    openModal() {
      this.waiting = false;
      this.modal.show();
    },
    close() {
      this.closeModal();
    },
    closeModal() {
      this.modal.hide();
    }
  }
}
</script>

<style scoped>

</style>