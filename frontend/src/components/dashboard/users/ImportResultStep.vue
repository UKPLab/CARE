<template>
  <div class="result-container">
    <div
      v-if="updatedUserCount"
      class="result-status"
    >
      <i18n-t keypath="dashboard.users.resultSummary" tag="p" class="result-summary">
        <template #newCount><strong>{{ updatedUserCount.new }}</strong></template>
        <template #updatedCount><strong>{{ updatedUserCount.updated }}</strong></template>
      </i18n-t>
      <div
        v-if="createdErrors.length > 0"
        class="error-container"
      >
        {{ $t('dashboard.users.failedListTitle') }}
        <ul
          v-for="(error, index) in createdErrors"
          :key="index"
        >
          <li>{{ $t('dashboard.users.userCannotBeAdded', { extId: error.extId, message: resolveApiMessage(error) }) }}</li>
        </ul>
      </div>
    </div>
    <div
      v-if="importType === 'moodle'"
      class="moodle-publish-intro"
    >
      <h3>Send login credentials to Moodle</h3>
      <p>
        CARE generated usernames and initial passwords for the imported users.
        Select the Moodle assignment where these credentials should be posted as feedback,
        or download them as a CSV file.
      </p>
    </div>
    <MoodleOptions
      v-if="importType === 'moodle'"
      :model-value="moodleOptions"
      with-assignment-id
      @update:model-value="$emit('update:moodleOptions', $event)"
    />
    <div class="link-container">
      <BasicButton
        v-if="importType === 'moodle'"
        class="btn btn-outline-info"
        :title="$t('dashboard.users.uploadToMoodle')"
        @click="$emit('upload-to-moodle')"
      />
      <BasicButton
        class="btn btn-outline-primary"
        :title="$t('dashboard.users.downloadResultCsv')"
        @click="$emit('download-csv')"
      />
    </div>
  </div>
</template>

<script>
import { resolveApiMessage } from "@/assets/utils.js";
import BasicButton from "@/basic/Button.vue";
import MoodleOptions from "@/basic/form/MoodleOptions.vue";

/**
 * Show bulk import results and the available credential export actions.
 */
export default {
  name: "ImportResultStep",
  components: { BasicButton, MoodleOptions },
  props: {
    importType: {
      type: String,
      required: true,
    },
    moodleOptions: {
      type: Object,
      required: true,
    },
    updatedUserCount: {
      type: Object,
      default: null,
    },
    createdErrors: {
      type: Array,
      required: true,
    },
  },
  methods: { resolveApiMessage },
  emits: ["update:moodleOptions", "upload-to-moodle", "download-csv"],
};
</script>

<style scoped>
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

.result-status {
  width: 100%;
  text-align: center;
}

.result-summary {
  margin-bottom: 0;
  font-size: 1.05rem;
  font-weight: 600;
}

.moodle-publish-intro {
  width: 100%;
  max-width: 500px;
  margin-top: 1.25rem;
  margin-bottom: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid #dee2e6;
  text-align: left;
}

.moodle-publish-intro h3 {
  margin-bottom: 0.35rem;
  font-size: 1rem;
  font-weight: 600;
}

.moodle-publish-intro p {
  margin-bottom: 0;
  color: #555;
  font-size: 0.925rem;
}

.error-container {
  margin: 0.25rem auto 0.5rem;
  color: firebrick;

  ul {
    margin-bottom: 0.25rem;
  }
}
</style>
