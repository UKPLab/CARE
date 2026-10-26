<template>
  <main class="auth-page">
    <div class="auth-shell">
      <LogoSvg :height="56" />
      <div class="card auth-card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h1 class="card-title">
            {{ title }}
          </h1>
          <slot name="header-action" />
        </div>
        <div class="card-body">
          <slot />
        </div>
      </div>
      <footer
        v-if="$slots.footer"
        class="auth-footer"
      >
        <slot name="footer" />
      </footer>
    </div>
  </main>
</template>

<script>
/**
 * Shared frame for the signed-out pages: logo, one narrow card, and an optional footer.
 * Field rows written as label/col-md-* pairs are stacked so pages keep their markup.
 *
 * @slot default - Card body
 * @slot header-action - Link or button next to the title
 * @slot footer - Content under the card
 *
 * @author Mohammad Sherif
 */
import LogoSvg from "@/basic/icon/LogoSvg.vue";

export default {
  name: "AuthLayout",
  components: { LogoSvg },
  props: {
    title: {
      type: String,
      required: true,
    },
  },
};
</script>

<style scoped>
.auth-page {
  height: 100vh;
  overflow-y: auto;
  display: grid;
  justify-items: center;
  align-content: start;
  padding: 8vh 16px 32px;
  background: var(--bs-tertiary-bg);
}

.auth-shell {
  width: 100%;
  max-width: 400px;
  display: grid;
  gap: 20px;
  justify-items: center;
}

.auth-card {
  width: 100%;
}

.auth-card .card-title {
  font-size: 1.15rem;
}

.auth-card .card-body {
  padding: 4px 20px 20px;
}

.auth-card :deep([class*="col-md-"]) {
  flex: 0 0 100%;
  width: 100%;
  margin-left: 0;
  text-align: start;
}

.auth-card :deep(.col-form-label) {
  padding-bottom: .25rem;
  font-size: .875rem;
  font-weight: 500;
}

.auth-footer {
  font-size: .75rem;
  text-align: center;
  color: var(--bs-secondary-color);
}
</style>
