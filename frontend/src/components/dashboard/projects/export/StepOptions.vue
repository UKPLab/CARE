<template>
  <div class="mt-2 mb-3 p-3 bg-light border rounded">
    <h6 class="mb-3 pb-2 border-bottom text-muted">
      Options
    </h6>

    <div class="form-check form-switch mb-2">
      <input 
        class="form-check-input" 
        type="checkbox" 
        id="anonymizeSwitch" 
        v-model="anonymize"
      >
      <label class="form-check-label" for="anonymizeSwitch">
        <strong>Generate aliases for student names</strong>
      </label>
    </div>
    
    <div v-if="anonymize">
      <label for="fakerSeedInput" class="form-label small mb-1">Custom Seed (Optional):</label>
      <input 
        id="fakerSeedInput"
        v-model.number="seed" 
        type="number" 
        class="form-control form-control-sm" 
        max="999999999"
        style="max-width: 200px;"
        placeholder="e.g. 846569412"
      >
      <small class="text-muted d-block mt-1">
        Using the same seed generates the same aliases across different exports.
      </small>
    </div>
  </div>
</template>

<script>
export default {
  name: "StepOptions",
  props: {
    anonymizeNames: {
      type: Boolean,
      default: false
    },
    fakerSeed: {
      type: Number,
      default: 846569412
    }
  },
  emits: ['update:anonymizeNames', 'update:fakerSeed'],
  computed: {
    anonymize: {
      get() { return this.anonymizeNames; },
      set(value) { this.$emit('update:anonymizeNames', value); }
    },
    seed: {
      get() { return this.fakerSeed; },
      set(value) { this.$emit('update:fakerSeed', value); }
    }
  }
}
</script>