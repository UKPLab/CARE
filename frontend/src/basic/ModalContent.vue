<template>
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
                @click="$emit('close')"
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
</template>
<script>
export default {
  name: 'ModalContent',
  props: {
   sizeClass: {type: String, default: ''},
   removeClose: {type: Boolean, default: false},
   scrollableBody: {type: Boolean, default: false},
   waiting: {type: Boolean, default: false},
   progress: {type: Boolean, default: false},
   progressPercent: {type: Number, default: 0},
 },
  emits: ['close'],
};
</script>
<style scoped>
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
