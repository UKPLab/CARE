<template>
      <!-- Stepper -->
      <div v-if="displaySteps.length" class="stepper">
        <div
          v-for="(step, index) in displaySteps"
          :key="step.key"
          :class="{ active: currentStep === index }"
          :data-index="index + 1"
        >
          {{ step.title }}
        </div>
      </div>

</template>
<script>
export default {name: 'SetupWizardProgress', props: {displaySteps: {type: Array, required: true}, currentStep: {type: Number, required: true}}};
</script>
<style scoped>
.stepper {
  --stepper-pad-top: 1.25rem;
  --stepper-circle: 30px;
  display: flex;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 2;
  margin-bottom: 1.5rem;
  background-color: var(--bs-body-bg, #fff);
  padding-top: var(--stepper-pad-top);
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--bs-border-color, #dee2e6);
}

.stepper::after {
  content: "";
  position: absolute;
  top: calc(var(--stepper-pad-top) + (var(--stepper-circle) / 2) - 1px);
  left: 0;
  right: 0;
  height: 2px;
  background-color: var(--bs-secondary-bg, #ccc);
}

.stepper > div {
  z-index: 1;
  background-color: var(--bs-body-bg, white);
  padding: 0 5px;
}

.stepper > div:first-child {
  padding-left: 0;
}

.stepper > div:last-child {
  padding-right: 0;
}

.stepper > div::before {
  content: attr(data-index);
  margin-right: 6px;
  display: inline-flex;
  width: var(--stepper-circle);
  height: var(--stepper-circle);
  border-radius: 50%;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--bs-border-color, #6c6b6b);
}

.stepper > div.active::before {
  color: var(--care-on-primary);
  background-color: var(--care-primary);
  border-color: var(--care-primary);
}

</style>
