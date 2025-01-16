<template>
  <BasicModal
    ref="stepperModal"
    name="stepperModal"
    lg
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
          v-if="currentStep < steps.length - 1"
          title="Next"
          class="btn btn-primary"
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
    validation: {
      type: Array,
      default: () => []
    },
  },
  emits: ["stepChange", "submit"],
  data() {
    return {
      currentStep: 0
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
    close() {
      this.$refs.stepperModal.close();
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

/* Preview */
.preview-table-container {
  height: 100%;
  white-space: nowrap;
  overflow-x: scroll;
}

.confirm-container,
.result-container {
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
}

.link-container {
  margin-top: 15px;

  button:first-child {
    margin-right: 0.5rem;
  }
}
</style>