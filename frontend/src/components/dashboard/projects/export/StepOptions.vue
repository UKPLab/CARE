<template>
  <div class="mt-2 mb-3 p-3 bg-light border rounded">
    <h6 class="mb-3 pb-2 border-bottom text-muted">
      {{ $t('dashboard.projects.exportOptions.title') }}
    </h6>

    <div class="form-check form-switch mb-2">
      <input 
        id="aliasSwitch" 
        v-model="aliases" 
        class="form-check-input" 
        type="checkbox"
      >
      <label class="form-check-label" for="aliasSwitch">
        <strong>{{ $t('dashboard.projects.exportOptions.generateAliases') }}</strong>
      </label>
    </div>
    
    <div v-if="aliases">
      <label for="fakerSeedInput" class="form-label small mb-1">
        {{ $t('dashboard.projects.exportOptions.customSeedOptional') }}
      </label>
      <input 
        id="fakerSeedInput"
        v-model.number="seed" 
        type="number" 
        class="form-control form-control-sm" 
        max="999999999"
        style="max-width: 200px;"
        :placeholder="$t('dashboard.projects.exportOptions.seedPlaceholder')"
      >
      <small class="text-muted d-block mt-1">
        {{ $t('dashboard.projects.exportOptions.seedHint') }}
        <strong>{{ $t('dashboard.projects.exportOptions.noteLabel') }}</strong>
        {{ $t('dashboard.projects.exportOptions.accountSpecificHint') }}
      </small>
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
 * @author Mélissa Loew
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
    }
  },
  emits: ['update:generateAliases', 'update:fakerSeed'],
  computed: {
    aliases: {
      get() { return this.generateAliases; },
      set(value) { this.$emit('update:generateAliases', value); }
    },
    seed: {
      get() { return this.fakerSeed; },
      set(value) { this.$emit('update:fakerSeed', value); }
    }
  }
}
</script>