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
        :class="sizeClass"
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
              @click="handleCloseClick"
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
            <div
              v-else-if="progress"
              class="justify-content-center flex-grow-1 d-flex"
              role="status"
            >
              <div class="progress" style="width:100%">
                <div class="progress-bar" role="progressbar" :style="'width:' + progressPercent + '%'"
                     :aria-valuenow="progressPercent" aria-valuemin="0"
                     aria-valuemax="100"> {{ progressPercent }}%
                </div>
              </div>
            </div>
            <div v-show="!waiting && !progress">
              <slot name="body"/>
            </div>
          </div>
          <div
            v-show="!waiting && !progress"
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
 * @props size: String Modal size (sm, md, lg, xl)
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
import {v4 as uuid} from "uuid";

export default {
  name: "BasicModal",
  inject: {
    acceptStats: {
      default: () => false
    },
    parentModal: {
      default: () => null
    }
  },
  props: {
    size: {
      type: String,
      required: false,
      default: 'md',
      validator: (value) => ['sm', 'md', 'lg', 'xl'].includes(value)
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
  emits: ['show', 'hide', 'close-requested'],
  provide() {
    return {
      parentModal: this
    };
  },
  data() {
    return {
      modal: null,
      waiting: false,
      progress: false,
      progressData: null,
      progressId: null,
      _suspendedByChild: false,
      _closeRequestHandled: false,
      _hideWaiting: false,
    }
  },
  computed: {
    sizeClass() {
      if (this.size === 'md') {
        return ''; // Default size, no additional class needed
      }
      return `modal-${this.size}`;
    },
    progressPercent() {
      if (this.progressData) {
        return Math.round(this.progressData.current / this.progressData.total * 100);
      }
      return 0;
    }
  },
  mounted() {
    this.modal = new Modal(this.$refs.Modal);
    this.$refs.Modal.addEventListener('hide.bs.modal', this.hideEvent);
    this.$refs.Modal.addEventListener('shown.bs.modal', this.showEvent);

    if (this.autoOpen) {
      this.openModal();
    }
  },
  beforeUnmount() {
    this.$refs.Modal.removeEventListener('hide.bs.modal', this.hideEvent);
    this.$refs.Modal.removeEventListener('shown.bs.modal', this.showEvent);
    this.modal.hide();
  },
  sockets: {
    progressUpdate: function (data) {
      if (data.id === this.progressId) {
        this.progressData = data;
      }
    }
  },
  methods: {
    getProgressId() {
      this.progressId = uuid();
      return this.progressId;
    },
    startProgress() {
      if (!this.progressId) {
        this.getProgressId();
      }
      this.progress = true;
      return this.progressId;
    },
    stopProgress() {
      this.progress = false;
    },
    hideEvent() {
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
      if (this._hideWaiting) {
        this._hideWaiting = false;
        this.hide();
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
      this.progress = false;
      this.suspendParentModal();
      this.modal.show();
    },
    handleCloseClick() {
      this._closeRequestHandled = false;
      this.$emit('close-requested');
      this.$nextTick(() => {
        if (!this._closeRequestHandled) {
          this.close();
        }
      });
    },
    markCloseRequestHandled() {
      this._closeRequestHandled = true;
    },
    close() {
      this.hide();
    },
    hide() {
      const modalElement = this.$refs.Modal;
      const isShown = modalElement.classList.contains('show');  
      if (isShown) {
        this.modal.hide();
      } else {
        this._hideWaiting = true;
      }
      this.resumeParentModal();
    },
    showParentModal(){
      if (this.parentModal) {
        this.parentModal.show();
      }
    },
    hideParentModal(){
      if (this.parentModal) {
        this.parentModal.hide();
      }
    },
    suspendParentModal(){
      if (!this.parentModal || this.parentModal._suspendedByChild) return;
      const el = this.parentModal.$refs && this.parentModal.$refs.Modal;
      if (el) {
        el.classList.add('nested-suspended');
      }
      this.parentModal._suspendedByChild = true;
    },
    resumeParentModal(){
      if (!this.parentModal || !this.parentModal._suspendedByChild) return;
      const el = this.parentModal.$refs && this.parentModal.$refs.Modal;
      if (el) {
        el.classList.remove('nested-suspended');
      }
      this.parentModal._suspendedByChild = false;
    }
  }
}
</script>

<style scoped>
.shake {
  animation: shake-animation 0.5s ease-in-out;
}
.nested-suspended {
  visibility: hidden;
  pointer-events: none;
}
</style>