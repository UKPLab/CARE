<template>
  <Modal
    ref="modal"
    lg
    name="terms"
    disable-keyboard
    remove-close
  >
    <template #title> Terms </template>
    <template #body>
      <h3>Terms of Service</h3>
      <div class="terms-container">
        <div v-html="config['terms']" />
      </div>
      <div class="consent-item">
        <label class="consent-label">
          <input
            v-model="acceptTerms"
            class="consent-input"
            type="checkbox"
          />
          I accept the Terms of Service
          <p
            v-if="showTermsError"
            class="error-message"
          >
            *Please accept the terms
          </p>
        </label>
      </div>
      <hr />
      <h3 v-if="config['requestStats'] || config['requestData']">Data Consent:</h3>
      <div
        v-if="config['requestStats']"
        class="consent-item"
      >
        <label class="consent-label">
          <input
            v-model="acceptStats"
            class="consent-input"
            type="checkbox"
          />
          I allow the collection of anonymous statistics</label
        >
      </div>
      <div
        v-if="config['requestData']"
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
 * The ToS must be agreed to by the user before they can proceed to use our platform.
 * The other two options (behavior tracking and data donation) are optional
 * and can be removed from this modal by toggling the switches in the settings.
 * @author: Linyin Huang
 */
import Modal from "@/basic/Modal.vue";
import axios from "axios";
import getServerURL from "@/assets/serverUrl";

export default {
  name: "ConsentModal",
  components: { Modal },
  data() {
    return {
      acceptTerms: false,
      acceptStats: false,
      acceptDataSharing: false,
      showTermsError: false,
    };
  },
  computed: {
    config() {
      return {
        terms: window.config["app.register.terms"],
        requestStats: JSON.parse(window.config["app.register.requestStats"]),
        isTrackingAgreed: JSON.parse(window.config["app.register.acceptStats.default"]),
        requestData: JSON.parse(window.config["app.register.requestData"]),
        isDataShared: JSON.parse(window.config["app.register.acceptDataSharing.default"]),
      };
    },
  },
  watch: {
    acceptTerms(newValue) {
      if (newValue) {
        this.showTermsError = false;
      }
    },
  },
  mounted() {
    // Sets initial values for acceptStats and acceptDataSharing
    if (this.config.requestStats) {
      this.acceptStats = this.config.isTrackingAgreed;
    }
    if (this.config.requestData) {
      this.acceptDataSharing = this.config.isDataShared;
    }
  },
  methods: {
    open() {
      this.$refs.modal.open();
      if(this.$store.getters["auth/getUserId"] === 3) {
        this.acceptDataSharing = true;
        this.acceptStats = true;
        this.acceptTerms = true;
      }
      else {
        this.acceptDataSharing = false;
        this.acceptStats = false;
        this.acceptTerms = false;
      }
    },
    async handleDecline() {
      this.resetForm();
      this.$refs.modal.close();
      await axios.get(getServerURL() + "/auth/logout", { withCredentials: true });
      await this.$router.push("/login");
    },
    handleAccept() {
      if (!this.acceptTerms) {
        this.showTermsError = true;
        return;
      }
      const consentData = {
        acceptTerms: this.acceptTerms,
        acceptStats: this.acceptStats,
        acceptDataSharing: this.acceptDataSharing,
        acceptedAt: new Date(),
      };
      this.$socket.emit("userUpdateConsent", consentData, (res) => {
        if (res.success) {
          this.resetForm();
          this.$refs.modal.close();
          this.$store.commit("auth/SET_USER", consentData );
          this.eventBus.emit("toast", {
            title: "User updated",
            message: res.message,
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: "Failed to update user",
            message: res.message,
            variant: "danger",
          });
        }
      });
    },
    resetForm() {
      this.acceptTerms = false;
      this.acceptStats = false;
      this.acceptDataSharing = false;
      this.showTermsError = false;
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
