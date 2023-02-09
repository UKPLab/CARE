<template>
  <div ref="Modal" aria-hidden="true" aria-labelledby="ModalLabel" class="modal fade"
       data-bs-backdrop="static" :data-bs-keyboard="!disableKeyboard"
       role="dialog" tabindex="-1">
    <div class="modal-dialog" :class="xl && 'modal-xl' || lg && 'modal-lg'" role="document">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">
            <slot name="title"></slot>
          </h5>
          <button v-if="!removeClose" type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
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
import LoadIcon from "@/icons/LoadIcon.vue"

export default {
  name: "Modal",
  components: {LoadIcon},
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
  data() {
    return {
      modal: null,
      waiting: false,
    }
  },
  mounted() {
    this.modal = new Modal(this.$refs.Modal);
    if (this.autoOpen) {
      this.openModal();
    }
  },
  methods: {
    open() {
      this.openModal();
    },
    openModal() {
      this.waiting = false;
      this.modal.show();
      this.$socket.emit("stats", {
        action: "openModal",
        data: {"name": this.name, "props": this.props}
      });
    },
    close() {
      this.closeModal();
    },
    closeModal() {
      this.modal.hide();
      this.$socket.emit("stats", {
        action: "hideModal",
        data: {"name": this.name, "props": this.props}
      });
    }
  }
}
</script>

<style scoped>

</style>