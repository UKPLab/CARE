<template>
  <div class="study-error-page d-flex flex-column align-items-center justify-content-center min-vh-100">
    <div class="error-card text-center p-5 bg-body rounded shadow">
      <i class="bi bi-exclamation-triangle-fill text-danger" style="font-size: 5rem;"></i>
      <h2 class="mt-4 text-danger">{{ error.title }}</h2>
      <p class="text-muted mb-4">{{ error.message }}</p>
      <div class="d-flex gap-3 justify-content-center">
        <router-link to="/" class="btn btn-primary">
          <i class="bi bi-house me-2"></i>{{ $t('components.studyRoute.errors.goToDashboard') }}
        </router-link>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * Full-page error of Study.vue, e.g. when the study does not exist or the user has no access
 *
 * @author Ilyas Mohammed
 */
export default {
  name: "StudyErrorPage",
  props: {
    // The error to show, with title and message
    error: {
      type: Object,
      required: true,
    },
  },
}
</script>

<style scoped>
.d-flex {
  width: 100%;
}

.study-error-page {
  background-color: var(--bs-tertiary-bg, #f5f5f5);
  min-height: 100vh;
}

.error-card {
  max-width: 500px;
  border: 1px solid var(--bs-border-color, #e0e0e0);
}
</style>
