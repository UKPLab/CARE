<template>
  <BasicModal
    ref="stepperModal"
    name="stepperModal"
    :size="size"
    scrollable-body
    @show="scrollToTop"
    @hide="$emit('hide')"
    @close-requested="handleCloseRequest"
  >
    <template #title>
      <slot name="title"/>
    </template>
    <template #body>
      <div v-if="!$slots['error']" class="stepper">
        <div
          v-for="(step, index) in steps"
          :key="index"
          :data-index="index + 1"
          :class="{ active: currentStep === index }"
        >
          {{ step.title }}
        </div>
      </div>
      <div ref="contentContainer" class="content-container">
        <div :key="'step-' + (currentStep + 1)">
          <template v-if="!!$slots['error']">
            <slot name="error"/>
          </template>
          <template v-else-if="$slots['step']">
            <slot name="step" :index="currentStep" :step="steps[currentStep]"/>
          </template>
          <template v-else-if="$slots['step-' + (currentStep + 1)]">
            <slot :name="'step-' + (currentStep + 1)"/>
          </template>
          <template v-else>
            <p>{{ $t('common.stepper.stepNotImplemented', { step: currentStep + 1 }) }}</p>
          </template>
        </div>
      </div>
    </template>
    <template #footer>
      <template v-if="!$slots['error']">
        <BasicButton
          v-if="currentStep === 0 && showClose"
          :title="$t('common.close')"
          class="btn btn-link me-auto"
          @click="close"
        />
        <slot name="buttons"/>
        <BasicButton
          v-if="currentStep !== 0"
          :title="$t('common.previous')"
          class="btn btn-outline-secondary"
          @click="currentStep--"
        />
        <BasicButton
          v-if="currentStep < steps.length - 1"
          :title="nextText || $t('common.nextText')"
          :class="['btn', currentStep === 0 && nextText && nextText.toLowerCase().includes('cancel') ? 'btn-danger' : 'btn-primary']"
          :disabled="disabled(currentStep)"
          @click="currentStep++"
        />
        <BasicButton
          v-if="currentStep === steps.length - 1"
          :title="submitText || $t('common.submitText')"
          class="btn btn-primary"
          :disabled="disabled(currentStep)"
          @click="submit"
        />
      </template>
      <BasicButton
        v-else
        :title="$t('common.close')"
        class="btn btn-primary"
        @click="close"
      />
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";

/**
 * Stepper Modal - Display multiple steps in a modal
 *
 * @author: Dennis Zyska, Linyin Huang
 */
export default {
  name: "StepperModal",
  components: {BasicButton, BasicModal},
  props: {
    steps: {
      type: Array,
      required: true
    },
    submitText: {
      type: String,
      default: null
    },
    nextText: {
      type: String,
      default: null
    },
    validation: {
      type: Array,
      default: () => []
    },
    showClose: {
      type: Boolean,
      default: false
    },
    size: {
      type: String,
      required: false,
      default: 'lg',
      validator: (value) => ['sm', 'md', 'lg', 'xl'].includes(value)
    }
  },
  emits: ["stepChange", "submit", 'hide', 'close-requested'],
  data() {
    return {
      currentStep: 0,
      closeRequestHandled: false,
    }
  },
  watch: {
    currentStep: {
      immediate: true,
      handler(value) {
        this.$emit("stepChange", value);
        this.scrollToTop();
      }
    }
  },
  methods: {
    scrollToTop() {
      this.$nextTick(() => {
        if (this.$refs.contentContainer) {
          this.$refs.contentContainer.scrollTop = 0;
        }
      });
    },
    open() {
      this.reset();
      this.$refs.stepperModal.open();
    },
    handleCloseRequest() {
      this.$refs.stepperModal.markCloseRequestHandled();
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
      this.$refs.stepperModal.hide();
    },
    show() {
      this.$refs.stepperModal.show();
    },
    reset() {
      this.currentStep = 0;
    },
    submit() {
      this.$emit("submit");
    },
    disabled(step) {
      // check validation has this step
      if (this.validation.length <= step) {
        return false;
      }
      return this.validation[step] === false;
    },
    setWaiting(value) {
      this.$refs.stepperModal.waiting = value;
    },
    getProgressId() {
      return this.$refs.stepperModal.getProgressId();
    },
    startProgress(){
      return this.$refs.stepperModal.startProgress();
    },
    stopProgress(){
      return this.$refs.stepperModal.stopProgress();
    },
  }
}

</script>


<style scoped>
.stepper + .content-container {
  padding-top: 1rem;
  border-top: 1px solid var(--bs-border-color-translucent);
}

.content-container {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}
</style>
