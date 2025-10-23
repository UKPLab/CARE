<template>
  <BasicModal
    ref="stepperModal"
    name="stepperModal"
    size="lg"
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
      <div class="content-container">
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
            <p>Step {{ currentStep + 1 }} is not implemented.</p>
          </template>
        </div>
      </div>
    </template>
    <template #footer>
      <div v-if="!$slots['error']" class="btn-group">
        <slot name="buttons"/>
        <BasicButton
          v-if="currentStep !== 0"
          title="Previous"
          class="btn btn-secondary"
          @click="currentStep--"
        />
        <BasicButton
          v-if="currentStep === 0 && showClose"
          title="Close"
          class="btn btn-secondary"
          @click="close"
        />
        <BasicButton
          v-if="currentStep < steps.length - 1"
          :title="nextText"
          :class="['btn', currentStep === 0 && nextText && nextText.toLowerCase().includes('cancel') ? 'btn-danger' : 'btn-primary']"
          :disabled="disabled(currentStep)"
          @click="currentStep++"
        />
        <BasicButton
          v-if="currentStep === steps.length - 1"
          :title="submitText"
          class="btn btn-primary"
          :disabled="disabled(currentStep)"
          @click="submit"
        />
      </div>
      <div v-else>
        <BasicButton
          title="Close"
          class="btn btn-primary"
          @click="close"
        />
      </div>
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
      default: "Submit"
    },
    nextText: {
      type: String,
      default: "Next"
    },
    validation: {
      type: Array,
      default: () => []
    },
    showClose: {
      type: Boolean,
      default: false
    },
  },
  emits: ["stepChange", "submit", 'hide', 'close-requested'],
  data() {
    return {
      currentStep: 0,
      _closeRequestHandled: false,
    }
  },
  watch: {
    currentStep: {
      immediate: true,
      handler(value) {
        this.$emit("stepChange", value);
      }
    }
  },
  methods: {
    open() {
      this.reset();
      this.$refs.stepperModal.open();
    },
    handleCloseRequest() {
      this.$refs.stepperModal.markCloseRequestHandled();
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
/* Stepper */
.stepper {
  display: flex;
  justify-content: space-between;
  margin-bottom: 1.25rem;
  position: relative;

  &:after {
    content: "";
    position: absolute;
    top: 15px;
    left: 0;
    right: 0;
    height: 2px;
    background-color: #ccc;
  }
}

.stepper div {
  z-index: 1;
  background-color: white;
  padding: 0 5px;

  &:before {
    --dimension: 30px;
    content: attr(data-index);
    margin-right: 6px;
    display: inline-flex;
    width: var(--dimension);
    height: var(--dimension);
    border-radius: 50%;
    align-items: center;
    justify-content: center;
    border: 1px solid #6c6b6b;
  }

  &:first-child {
    padding-left: 0;
  }

  &:last-child {
    padding-right: 0;
  }
}

.stepper div.active {
  --btn-color: #0d6efd;
  border-color: var(--btn-color);

  &:before {
    color: white;
    background-color: var(--btn-color);
    border-color: var(--btn-color);
  }
}


.content-container {
  height: 100%;
}
</style>