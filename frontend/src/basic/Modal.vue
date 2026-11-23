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
      <ModalContent
        :size-class="sizeClass" :remove-close="removeClose" :scrollable-body="scrollableBody"
        :waiting="waiting" :progress="progress" :progress-percent="progressPercent" @close="handleCloseClick">
        <template #title><slot name="title" /></template>
        <template #body><slot name="body" /></template>
        <template #footer><slot name="footer" /></template>
      </ModalContent>
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
import ModalContent from './ModalContent.vue';
import {Modal} from 'bootstrap';
import {v4 as uuid} from 'uuid';

export default {
  name: 'BasicModal',
  components: {ModalContent},
  inject: {
    documentId: {type: Number, required: false, default: null},
    acceptStats: {
      default: () => false
    },
    parentModal: {
      default: () => null
    },
    studySessionId: {
      default: () => null
    },
    currentStudyStep: {
      default: () => null
    },
    studyStepId: {
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
      default: 'md',
      validator: (value) => ['sm', 'md', 'lg', 'xl'].includes(value)
    },
    autoOpen: {type: Boolean, default: false},
    disableKeyboard: {type: Boolean, default: false},
    removeClose: {type: Boolean, default: false},
    props: {
      type: Object,
      default: () => ({}),
    },
    name: {
      type: String,
      required: true
    },
    scrollableBody: {type: Boolean, default: false}
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
      pendingTransition: null,
    };
  },
  computed: {
    // Study IDs for the stats events; empty outside a study
    studyContext() {
      return {
        ...(this.documentId ? {documentId: this.documentId} : {}),
        ...(this.studySessionId ? {studySessionId: this.studySessionId} : {}),
        ...(this.currentStudyStep?.id ? {currentStudyStepId: this.currentStudyStep.id} : {}),
        ...(this.studyStepId ? {studyStepId: this.studyStepId} : {}),
      };
    },
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
    this.$refs.Modal.addEventListener('show.bs.modal', this.transitionStartEvent);
    this.$refs.Modal.addEventListener('hide.bs.modal', this.transitionStartEvent);
    this.$refs.Modal.addEventListener('hidden.bs.modal', this.hideEvent);
    this.$refs.Modal.addEventListener('shown.bs.modal', this.showEvent);

    if (this.autoOpen) {
      this.openModal();
    }
  },
  beforeUnmount() {
    // A modal removed while open never gets Bootstrap's hidden event, so log its hide here
    if (this.isShown) {
      this.logHide();
    }
    const el = this.$refs.Modal;
    if (el) {
      el.removeEventListener('show.bs.modal', this.transitionStartEvent);
      el.removeEventListener('hide.bs.modal', this.transitionStartEvent);
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
    /**
     * Remembers which Bootstrap transition is running, as Bootstrap only reports its end through events.
     * Also covers transitions Bootstrap starts on its own, e.g. on the Escape key.
     * @param {Event} event The show.bs.modal or hide.bs.modal event
     */
    transitionStartEvent(event) {
      this.pendingTransition = event.type.split('.')[0];
    },
    /**
     * Disposes the Bootstrap modal of the unmounting component.
     *
     * Bootstrap's queued transition callbacks read the fields dispose() clears, and only its hide path removes
     * the backdrop and the scroll lock from the body. So a modal in use has to reach hidden before it is disposed.
     * By then the component is gone, so the callbacks below only use captured values.
     */
    disposeModal() {
      const modal = this.modal;
      const element = this.$refs.Modal;
      const dispose = () => {
        // A static backdrop transition has up to two callbacks left on the dialog, finish them now.
        const dialog = element.querySelector('.modal-dialog');
        dialog.dispatchEvent(new Event('transitionend'));
        dialog.dispatchEvent(new Event('transitionend'));
        modal.dispose();
        // Bootstrap appends the element to the body again if it finishes opening after Vue removed it.
        element.remove();
      };

      if (!this.isShown && !this.pendingTransition) {
        dispose();
        return;
      }

      // Without the fade class, the steps still to come run at once and the removed modal is never painted again.
      element.classList.remove('fade');
      if (this.pendingTransition === 'show') {
        // Only listen for hidden from here on, the hidden event of an earlier close can arrive during this opening.
        element.addEventListener('shown.bs.modal', () => {
          element.addEventListener('hidden.bs.modal', dispose, {once: true});
          modal.hide();
        }, {once: true});
        return;
      }
      element.addEventListener('hidden.bs.modal', dispose, {once: true});
      if (!this.pendingTransition) {
        modal.hide();
      }
    },
    hideEvent() {
      this.isShown = false;
      // Bootstrap allows reopening while the backdrop of a close fades out, that opening is still running.
      if (this.pendingTransition === 'hide') {
        this.pendingTransition = null;
      }
      this.$emit('hide');
      this.logHide();
    },
    /**
     * Logs that the modal was hidden, if the user accepted statistics.
     */
    logHide() {
      if (this.acceptStats) {
        this.$socket.emit('stats', {
          action: 'hideModal',
          data: {name: this.name, props: this.props, ...this.studyContext}
        });
      }
    },
    showEvent() {
      this.isShown = true;
      this.pendingTransition = null;
      this.$emit('show');
      if (this.acceptStats) {
        this.$socket.emit('stats', {
          action: 'showModal',
          data: {name: this.name, props: this.props, ...this.studyContext}
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

</style>
