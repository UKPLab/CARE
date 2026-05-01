<template>
  <BasicModal
      ref="modal"
      size="lg"
      name="ConsentUpdateModal">
    <template #title>
      <span>{{ $t('auth.updateConsent') }}</span>
    </template>
    <template #body>
      <div
          v-if="requestData"
          class="consent-item"
      >
        <label class="consent-label">
          <input
              v-model="acceptDataSharing"
              class="consent-input"
              type="checkbox"
          />
          {{ $t('auth.acceptDataSharing') }}
        </label>
      </div>
      <div
          v-if="requestStats"
          class="consent-item"
      >
        <label class="consent-label">
          <input
              v-model="acceptStats"
              class="consent-input"
              type="checkbox"
          />
          {{ $t('auth.acceptStatsBehavior') }}
        </label>
      </div>
    </template>
    <template #footer>
      <span class="btn-group">
        <BasicButton
            :title="$t('common.cancel')"
            class="btn btn-secondary"
            @click="$refs.modal.close()"
        />
        <BasicButton
            :title="$t('common.confirm')"
            class="btn btn-primary"
            @click="confirm"
        />
      </span>
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import { resolveApiMessage } from "@/assets/utils";

/**
 * Modal for updating user's consent
 *
 * @author: Linyin Huang
 */
export default {
  name: "ConsentUpdateModal",
  components: {BasicModal, BasicButton},
  data() {
    return {
      acceptStats: false,
      acceptDataSharing: false,
    };
  },
  computed: {
    user() {
      return this.$store.getters["auth/getUser"];
    },
    requestStats() {
      return this.$store.getters["settings/getValue"]("app.register.requestStats") === "true";
    },
    requestData() {
      return this.$store.getters["settings/getValue"]("app.register.requestData") === "true";
    },
  },
  watch: {
    user: {
      handler(newUser) {
        if (newUser) {
          this.acceptStats = newUser.acceptStats;
          this.acceptDataSharing = newUser.acceptDataSharing;
        }
      },
      immediate: true,
    },
  },
  methods: {
    open() {
      this.$refs.modal.open();
    },
    confirm() {
      const consentData = {
        acceptTerms: true,
        acceptStats: this.acceptStats,
        acceptDataSharing: this.acceptDataSharing,
      };
      this.$socket.emit("userConsentUpdate", consentData, (res) => {
        if (res.success) {
          this.$refs.modal.close();
          this.$store.commit("auth/SET_USER", res.data);
          this.eventBus.emit("toast", {
            title: this.$t('auth.messages.consentUpdated'),
            message: this.$t('auth.messages.consentUpdatedMessage'),
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: this.$t('errors.auth.consentUpdateError'),
            message: resolveApiMessage(res),
            variant: "danger",
          });
        }
      });
    },
  },
};
</script>

<style scoped>
.consent-item {
  margin-bottom: 10px;
}

.consent-label {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}

.consent-input {
  margin-right: 0.5rem;
}
</style>
