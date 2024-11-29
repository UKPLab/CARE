<template>
  <Modal
    ref="modal"
    xl
    name="terms"
    disable-keyboard
    remove-close
  >
    <template #title> Terms</template>
    <template #body>
      <div class="terms-container">
        <div v-html="terms"/>
      </div>
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
          I agree to my data being made available for research purposes
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
          I allow the collection of behaviour statistics for research purpose
        </label>
      </div>
    </template>
    <template #footer>
      <div class="button-group">
        <button
          type="button"
          class="btn btn-secondary"
          @click="handleDecline"
        >
          Decline
        </button>
        <button
          type="button"
          class="btn btn-primary"
          @click="handleAccept"
        >
          Accept & Continue
        </button>
      </div>
    </template>
  </Modal>
</template>

<script>
/**
 * Show terms and consent options in a modal
 * The ToS must be agreed to by the user before they can proceed.
 * The other two options (behavior tracking and data donation) are optional
 * and can be removed from this modal by toggling the switches in the settings.
 * @author: Linyin Huang, Dennis Zyska
 */
import Modal from "@/basic/Modal.vue";
import axios from "axios";
import getServerURL from "@/assets/serverUrl";

export default {
  name: "ConsentModal",
  components: {Modal},
  data() {
    return {
      acceptStats: false,
      acceptDataSharing: false,
    };
  },
  computed: {
    requestStats() {
      return this.$store.getters["settings/getValue"]('app.register.requestStats') === "true";
    },
    acceptStatsDefault() {
      return this.$store.getters["settings/getValue"]('app.register.acceptStats.default') === "true";
    },
    requestData() {
      return this.$store.getters["settings/getValue"]('app.register.requestData') === "true";
    },
    acceptDataSharingDefault() {
      return this.$store.getters["settings/getValue"]('app.register.acceptDataSharing.default') === "true";
    },
    terms() {
      return this.$store.getters["settings/getValue"]('app.register.terms');
    },
  },
  mounted() {
    this.acceptStats = this.acceptStatsDefault;
    this.acceptDataSharing = this.acceptDataSharingDefault;
  },
  methods: {
    open() {
      this.$refs.modal.open();
    },
    async handleDecline() {
      this.resetForm();
      this.$refs.modal.close();
      await axios.get(getServerURL() + "/auth/logout", {withCredentials: true});
      await this.$router.push("/login");
    },
    handleAccept() {
      const consentData = {
        acceptTerms: true,
        acceptStats: this.acceptStats,
        acceptDataSharing: this.acceptDataSharing,
      };
      this.$socket.emit("userConsentUpdate", consentData, (res) => {
        if (res.success) {
          this.resetForm();
          this.$refs.modal.close();
          this.$store.commit("auth/SET_USER", res.data);
          this.eventBus.emit("toast", {
            title: "Terms successful updated",
            message: "The terms are successfully updated",
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: "Error in updating terms",
            message: res.message,
            variant: "danger",
          });
        }
      });
    },
    resetForm() {
      this.acceptStats = false;
      this.acceptDataSharing = false;
    },
  },
};
</script>

<style scoped>
.terms-container {
  height: 400px;
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  padding: 1rem;
  margin-bottom: 15px;
  border-radius: 4px;
}

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

.error-message {
  margin: 0;
  margin-left: 0.75em;
  font-size: 0.75em;
  line-height: 0.75em;
  color: firebrick;
}

.button-group > button:first-child {
  margin-right: 1rem;
}
</style>
