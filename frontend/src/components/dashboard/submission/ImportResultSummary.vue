<template>
  <div class="result-container">
    <div v-if="results && results.successCount != null">
      <i18n-t keypath="dashboard.importModal.successfullyImported" tag="span">
        <template #count>
          <strong>{{ results.successCount }}</strong>
        </template>
      </i18n-t>
      <div
        v-if="results.errors && results.errors.length > 0"
        class="error-container"
      >
        {{ $t('dashboard.importModal.failedToImport') }}
        <ul
          v-for="(error, index) in results.errors"
          :key="index"
        >
          <li>
            {{ $t('dashboard.importModal.userCannotBeImported', {
              userId: error.userId,
              message: resolveApiMessage(error),
            }) }}
          </li>
        </ul>
      </div>
      <div v-if="results?.errors?.length > 0" class="link-container">
        <BasicButton
          class="btn btn-outline-primary"
          :title="$t('dashboard.importModal.downloadErrorCSV')"
          @click="downloadErrorsAsCSV"
        />
      </div>
    </div>
  </div>
</template>

<script>
import BasicButton from "@/basic/Button.vue";
import { downloadObjectsAs, resolveApiMessage } from "@/assets/utils.js";

/**
 * Outcome of a Moodle submission import: success count, per-user errors, and
 * a CSV download of the errors.
 *
 * @author: Dennis Zyska, Linyin Huang
 */
export default {
  name: "ImportResultSummary",
  components: { BasicButton },
  props: {
    results: {
      type: Object,
      default: () => ({}),
    },
  },
  methods: {
    resolveApiMessage,
    downloadErrorsAsCSV() {
      const filename = `submissions_${Date.now()}`;
      const rows = this.results.errors.map((err) => {
        const { params: _params, ...rest } = err;
        return {
          ...rest,
          message: resolveApiMessage(err),
        };
      });
      downloadObjectsAs(rows, filename, "csv");
    },
  },
};
</script>

<style scoped>
.result-container {
  height: 100%;
}

.link-container {
  text-align: center;
  margin-top: 15px;

  button:first-child {
    margin-right: 0.5rem;
  }
}

.error-container {
  margin: 0.25rem auto 0.5rem;
  color: var(--bs-form-invalid-color);

  ul {
    margin-bottom: 0.25rem;
  }
}
</style>
