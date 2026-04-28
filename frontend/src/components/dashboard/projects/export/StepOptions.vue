<template>
  <div class="mt-2 mb-3 p-3 bg-light border rounded">
    <h6 class="mb-3 pb-2 border-bottom text-muted">
      Options
    </h6>

    <div class="form-check form-switch mb-2">
      <input 
        class="form-check-input" 
        type="checkbox" 
        id="aliasSwitch" 
        v-model="aliases"
      >
      <label class="form-check-label" for="aliasSwitch">
        <strong>Generate aliases for student names</strong>
      </label>
    </div>
    
    <div v-if="aliases">
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
        Using the same seed ensures consistent aliases for your own exports. <strong>Note:</strong> Aliases are tied to your account and won't match other users' exports.
      </small>
    </div>

    <div v-if="showGradeFormat" class="mt-3">
      <label for="gradeFormatSelect" class="form-label small mb-1">Grade file format:</label>
      <select id="gradeFormatSelect" v-model="gradeFormatValue" class="form-select form-select-sm" style="max-width: 220px;">
        <option value="json">JSON</option>
        <option value="csv">CSV</option>
      </select>
    </div>
  </div>
</template>

<script>
/**
 * StepOptions
 *
 * Provides configuration options for the export process. Currently, it allows 
 * the user to toggle alias generation for student names and set a custom seed for it.
 *
 * @author Mélissa Loew, Linyin Huang
 */

export default {
  name: "StepOptions",
  props: {
    generateAliases: {
      type: Boolean,
      default: false
    },
    fakerSeed: {
      type: Number,
      default: 846569412
    },
    showGradeFormat: {
      type: Boolean,
      default: false
    },
    gradeFormat: {
      type: String,
      default: "json"
    }
  },
  emits: ['update:generateAliases', 'update:fakerSeed', 'update:gradeFormat'],
  computed: {
    aliases: {
      get() { return this.generateAliases; },
      set(value) { this.$emit('update:generateAliases', value); }
    },
    seed: {
      get() { return this.fakerSeed; },
      set(value) { this.$emit('update:fakerSeed', value); }
    },
    gradeFormatValue: {
      get() { return this.gradeFormat; },
      set(value) { this.$emit('update:gradeFormat', value); }
    }
  }
}
</script>