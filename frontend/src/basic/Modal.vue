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
                :aria-label="$t('modals.closeModal')"
                class="btn-close"
                type="button"
                @click="handleCloseClick"
            />
          </div>
          <div class="modal-body" :class="{ 'modal-body-scroll': scrollableBody }">
            <div
                v-if="waiting"
                class="justify-content-center flex-grow-1 d-flex"
                role="status"
            >
              <div class="spinner-border m-5">
                <span class="visually-hidden">{{ $t('common.loading') }}</span>
              </div>
            </div>
            <div
                v-else-if="progress"
                class="justify-content-center flex-grow-1 d-flex"
                role="status"
            >
              <div class="progress" style="width:100%">
                <div
                    class="progress-bar"
                    role="progressbar"
                    :style="'width:' + progressPercent + '%'"
                    :aria-valuenow="progressPercent"
                    aria-valuemin="0"
                    aria-valuemax="100"
                >
                  {{ progressPercent }}%
                </div>
              </div>
            </div>
            <div
                v-show="!waiting && !progress"
                :class="{ 'modal-body-shell': scrollableBody }"
            >
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
 * @props scrollableBody: Boolean Make the body a flex column so a fixed header (e.g. a stepper) can stay put while only the body content scrolls
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
import {v4 as uuid} from 'uuid';

export default {
  name: 'BasicModal',
  inject: {
    acceptStats: {
      default: () => false
    },
    parentModal: {
      default: () => null
    }
  },
  provide() {
    return {
      parentModal: this
    };
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
    },
    scrollableBody: {
      type: Boolean,
      required: false,
      default: false,
    }
  },
  emits: ['show', 'hide', 'close-requested'],
  data() {
    return {
      modal: null,
      waiting: false,
      progress: false,
      progressData: null,
      progressId: null,
      suspendedByChild: false,
      closeRequestHandled: false,
      hideWaiting: false,
      isShown: false,
    };
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
    this.$refs.Modal.addEventListener('hidden.bs.modal', this.hideEvent);
    this.$refs.Modal.addEventListener('shown.bs.modal', this.showEvent);

    if (this.autoOpen) {
      this.openModal();
    }
  },
  beforeUnmount() {
    const el = this.$refs.Modal;
    if (el) {
      el.removeEventListener('hidden.bs.modal', this.hideEvent);
      el.removeEventListener('shown.bs.modal', this.showEvent);
    }
    const modal = this.modal;
    this.modal = null;
    if (modal) {
      this.disposeWhenIdle(modal, el);
    }
    this.resumeParentModal();
  },
  sockets: {
    progressUpdate: function (data) {
      if (data.id === this.progressId) {
        this.progressData = data;
      }
    }
  },
  methods: {
    /**
     * Dispose the Bootstrap modal only once it is fully closed.
     *
     * Closing and navigating in one click (e.g. "Start study") unmounts the component
     * while the fade-out still runs. Bootstrap's pending transition callback then
     * touches `this._element.style`, which dispose() has already set to null:
     * "can't access property 'style', this._element is null". So while the modal is
     * open or animating, close it first and dispose on `hidden.bs.modal`.
     * The detached element is still a valid node for those callbacks.
     *
     * @param {Modal} modal - Bootstrap modal instance
     * @param {HTMLElement|null} el - its element
     */
    disposeWhenIdle(modal, el) {
      const dispose = () => {
        try {
          modal.dispose();
        } catch (e) {
          console.error('[BasicModal] Error during modal dispose:', e.message);
        }
      };

      // Private Bootstrap 5 state; fall back to the CSS class if it ever changes.
      const transitioning = !!modal._isTransitioning;
      const shown = modal._isShown ?? el?.classList.contains('show');
      if (!el || (!shown && !transitioning)) {
        dispose();
        return;
      }

      let finished = false;
      let fallback = null;
      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(fallback);
        el.removeEventListener('hidden.bs.modal', finish);
        el.removeEventListener('shown.bs.modal', hideAfterShow);
        dispose();
        // Unmounted while open: make sure no backdrop or scroll lock is left behind,
        // unless another modal is still open.
        if (!document.querySelector('.modal.show')) {
          document.querySelectorAll('.modal-backdrop').forEach((b) => b.remove());
          document.body.classList.remove('modal-open');
          document.body.style.removeProperty('overflow');
          document.body.style.removeProperty('padding-right');
        }
      };
      // Still opening: Bootstrap ignores hide() during a transition, so hide once shown.
      const hideAfterShow = () => modal.hide();

      el.addEventListener('hidden.bs.modal', finish);
      if (shown && transitioning) {
        el.addEventListener('shown.bs.modal', hideAfterShow, {once: true});
      } else if (shown) {
        modal.hide();
      }
      // Transitions take ~300ms; never keep the instance around for long.
      fallback = setTimeout(finish, 1500);
    },
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
      this.isShown = false;
      this.$emit('hide');
      if (this.acceptStats) {
        this.$socket.emit('stats', {
          action: 'hideModal',
          data: {name: this.name, props: this.props}
        });
      }
    },
    showEvent() {
      this.isShown = true;
      this.$emit('show');
      if (this.acceptStats) {
        this.$socket.emit('stats', {
          action: 'showModal',
          data: {name: this.name, props: this.props}
        });
      }
      if (this.hideWaiting) {
        this.hideWaiting = false;
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
      this.modal?.show();
    },
    handleCloseClick() {
      this.closeRequestHandled = false;
      this.$emit('close-requested');
      this.$nextTick(() => {
        if (!this.closeRequestHandled) {
          this.close();
        }
      });
    },
    markCloseRequestHandled() {
      this.closeRequestHandled = true;
    },
    close() {
      this.hide();
    },
    hide() {
      if (this.isShown) {
        this.modal?.hide();
      } else {
        this.hideWaiting = true;
      }
      this.resumeParentModal();
    },
    showParentModal() {
      if (this.parentModal) {
        this.parentModal.show();
      }
    },
    hideParentModal() {
      if (this.parentModal) {
        this.parentModal.hide();
      }
    },
    suspendByChild() {
      if (this.suspendedByChild) return;
      const el = this.$refs && this.$refs.Modal;
      if (el) {
        el.classList.add('nested-suspended');
      }
      this.suspendedByChild = true;
    },
    resumeFromChild() {
      if (!this.suspendedByChild) return;
      const el = this.$refs && this.$refs.Modal;
      if (el) {
        el.classList.remove('nested-suspended');
      }
      this.suspendedByChild = false;
    },
    suspendParentModal() {
      this.parentModal?.suspendByChild();
    },
    resumeParentModal() {
      this.parentModal?.resumeFromChild();
    }
  }
};
</script>

<style scoped>
.shake {
  animation: shake-animation 0.5s ease-in-out;
}

.nested-suspended {
  visibility: hidden;
  pointer-events: none;
}

.modal-content {
  max-height: calc(100vh - 3.5rem);
  display: flex;
  flex-direction: column;
}

.modal-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}

/* Body is a non-scrolling flex column so a fixed header (e.g. a stepper)
   stays put while only its content scrolls. Lives here because the modal is
   teleported. */
.modal-body.modal-body-scroll {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-top: 0;
}

.modal-body-shell {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}
</style>
