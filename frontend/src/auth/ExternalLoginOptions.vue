<template>
            <hr v-if="showExternalLoginOptions">

            <div v-if="showExternalLoginOptions" class="col-md-8 offset-md-2 mt-3">
              <p class="text-center text-muted small mb-2">
                {{ $t('auth.orSignInWith') }}
              </p>
              <div class="d-grid gap-2">
                <BasicButton
                  v-if="showOrcidLogin"
                  class="btn btn-outline-success btn-block"
                  text="ORCID"
                  @click="loginWithOrcid"
                />
                <BasicButton
                  v-if="showLdapLogin"
                  class="btn btn-outline-secondary btn-block"
                  text="LDAP"
                  @click="toLdapLogin"
                />
                <BasicButton
                  v-if="showSamlLogin"
                  class="btn btn-outline-dark btn-block"
                  text="SSO"
                  @click="loginWithSaml"
                />
              </div>
            </div>

</template>
<script>
import BasicButton from '@/basic/Button.vue';
import getServerURL from '@/assets/serverUrl';
export default {
  name: 'ExternalLoginOptions',
  components: {BasicButton},
  computed: {
    showOrcidLogin() {
      return window.config['system.auth.orcid.enabled'] === 'true';
    },
    showLdapLogin() {
      return window.config['system.auth.ldap.enabled'] === 'true';
    },
    showSamlLogin() {
      return window.config['system.auth.saml.enabled'] === 'true';
    },
    showExternalLoginOptions() {
      return this.showOrcidLogin || this.showLdapLogin || this.showSamlLogin;
    }
 },
  methods: {
    loginWithOrcid() {
      const redirectedFrom = this.$route.query.redirectedFrom;
      const query = redirectedFrom ? `?redirectedFrom=${encodeURIComponent(redirectedFrom)}`: "";
      window.location.href = getServerURL() + "/auth/login/orcid" + query;
    },
    loginWithSaml() {
      const redirectedFrom = this.$route.query.redirectedFrom;
      const query = redirectedFrom ? `?redirectedFrom=${encodeURIComponent(redirectedFrom)}`: "";
      window.location.href = getServerURL() + "/auth/login/saml" + query;
    },
    toLdapLogin() {
      this.$router.push({
        name: "login-ldap",
        query: { redirectedFrom: this.$route.query.redirectedFrom },
      });
    }
 },
};
</script>
