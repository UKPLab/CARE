<template>
  <AuthLayout :title="$t('errors.page.notFoundTitle')">
    <p class="text-secondary">
      {{ $t('errors.page.notFoundMessage') }}
    </p>
    <router-link
      class="btn btn-primary w-100"
      to="/dashboard"
    >
      {{ $t('errors.page.goToDashboard') }}
    </router-link>
  </AuthLayout>
</template>

<script>
/**
 * Default page for unknown paths
 *
 * This module describes the default page shown for unknown paths.
 *
 * @author: Dennis Zyska
 */
import AuthLayout from "@/auth/AuthLayout.vue";

export default {
  name: "NotFoundPage",
  components: { AuthLayout },
};
</script>
