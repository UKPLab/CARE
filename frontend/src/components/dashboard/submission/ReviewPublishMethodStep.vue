<template>
  <div class="mb-3">
    <label for="publishMethod" class="form-label">
      <b>{{ $t('dashboard.publishModal.publishMethod') }}</b>
    </label>
    <select
      id="publishMethod"
      :value="publishMethod"
      class="form-select"
      @change="$emit('update:publishMethod', $event.target.value)"
    >
      <option
        v-for="opt in publishMethodOptions"
        :key="opt.value"
        :value="opt.value"
        :disabled="opt.disabled"
      >
        {{ opt.label }}
      </option>
    </select>
  </div>

  <div
    v-if="isSubmissionMode"
    class="small"
  >
    <p>{{ $t('dashboard.publishModal.chooseDownloadCSV') }}</p>
  </div>

  <div v-if="publishMethod === 'moodle'">
    <MoodleOptions
      :model-value="moodleOptions"
      with-assignment-id
      @update:model-value="$emit('update:moodleOptions', $event)"
    />
  </div>
</template>

<script>
import MoodleOptions from "@/basic/form/MoodleOptions.vue";

/**
 * Review publishing, step 5: download the links as CSV or send them to
 * Moodle (which needs the Moodle connection options).
 *
 * @author Dennis Zyska, Linyin Huang
 */
export default {
  name: "ReviewPublishMethodStep",
  components: {MoodleOptions},
  props: {
    /** "csv", "moodle" or "email" (not available yet). */
    publishMethod: {type: String, required: true},
    moodleOptions: {type: Object, required: true},
    isSubmissionMode: {type: Boolean, default: false},
    /** Publish methods as {value, label, disabled}. */
    publishMethodOptions: {type: Array, required: true},
  },
  emits: ["update:publishMethod", "update:moodleOptions"],
};
</script>
