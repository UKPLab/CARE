<template>
  <teleport to="body">
    <div
      ref="Modal"
      :data-bs-keyboard="!disableKeyboard"
      aria-hidden="true"
      aria-labelledby="ModalLabel"
      class="modal fade"
      data-bs-backdrop="static"
      role="dialog"
      tabindex="-1"
    >
      <div
        :class="xl && 'modal-xl' || lg && 'modal-lg'"
        class="modal-dialog"
        role="document"
      >
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <slot name="title"/>
            </h5>
            <button
              v-if="!removeClose"
              aria-label="Close"
              class="btn-close"
              data-bs-dismiss="modal"
              type="button"
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
              <slot name="body"/>
            </div>
          </div>
          <div
            v-if="!waiting"
            class="modal-footer"
          >
            <slot name="footer"/>
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script>
/**
 * Basic Modal to include in other components
 *
 * @props xl: Boolean Use xl size
 * @props lg: Boolean Use lg size
 * @props autoOpen: Boolean Open modal on mount
 * @props disableKeyboard: Boolean Disable keyboard events
 * @props removeClose: Boolean Remove close button
 * @props props: Object Props for statistics (socket emit stats with data)
 * @props name: Name of the modal (for statistics)
 * @emits show: Event triggered on show
 * @emits hide: Event triggered on hide
 * @slot title: Title of the modal
 * @slot body: Body of the modal
 * @slot footer: Footer of the modal
 *
 * @author: Dennis Zyska, Nils Dycke
 *
 */
import {Modal} from 'bootstrap';

export default {
  name: "BasicModal",
  inject: {
    acceptStats: {
      default: () => false
    }
  },
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
      required: false,
      default: () => ({}),
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
    hideEvent() {
      console.log("hide");
      this.$emit('hide');
      if (this.acceptStats) {
        this.$socket.emit("stats", {
          action: "hideModal",
          data: {"name": this.name, "props": this.props}
        });
      }
    },
    showEvent() {
      this.$emit('show');
      if (this.acceptStats) {
        this.$socket.emit("stats", {
          action: "showModal",
          data: {"name": this.name, "props": this.props}
        });
      }
    },
    open() {
      this.openModal();
    },
    show() {
      this.openModal();
    },
    openModal() {
      this.waiting = false;
      this.modal.show();
    },
    close() {
      this.modal.hide();
    },
    hide() {
      this.modal.hide();
    },
    toggle() {
      this.modal.toggle();
    },
  }
}
</script>

<style scoped>

</style>