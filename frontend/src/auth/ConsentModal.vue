<template>
  <Modal
    lg
    ref="modal"
    name="terms"
    disable-keyboard
    remove-close
  >
    <template #title> Terms </template>
    <template #body>
      <h3>Terms of Service</h3>
      <div class="terms-container">
        <div v-html="terms" />
      </div>
      <div class="consent-item">
        <label class="consent-label">
          <input
            class="consent-input"
            type="checkbox"
            v-model="termsConsented"
          />
          I agree to the Terms of Service
          <p
            v-if="showTermsError"
            class="error-message"
          >
            *Please accept the terms
          </p>
        </label>
      </div>
      <hr />
      <h3>Data Consent:</h3>
      <div class="consent-item">
        <label class="consent-label">
          <input
            class="consent-input"
            type="checkbox"
            v-model="trackingAgreed"
          />
          I consent to behavior tracking</label
        >
      </div>
      <div class="consent-item">
        <label class="consent-label">
          <input
            class="consent-input"
            type="checkbox"
            v-model="dataShared"
          />
          I agree to donate my usage data
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
      termsConsented: false,
      trackingAgreed: false,
      dataShared: false,
      showTermsError: false,
    };
  },
  computed: {
    terms() {
      return window.config["app.register.terms"];
    },
  },
  methods: {
    open() {
      // FIXME: Modal always opens on the login page
      this.$refs.terms.open();
    },
    async handleDecline() {
      await axios.get(getServerURL() + "/auth/logout", { withCredentials: true });
      await this.$router.push("/login");
    },
    handleAccept() {
      if (!this.termsConsented) {
        this.showTermsError = true;
        return;
      }
      const consentData = {
        termsConsented: this.termsConsented,
        trackingAgreed: this.trackingAgreed,
        dataShared: this.dataShared,
        consentedAt: new Date(),
      };
      this.$socket.emit("userUpdateConsent", consentData, (res) => {
        if (res.success) {
          this.resetForm();
          this.$refs.modal.close();
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
      this.termsConsented = false;
      this.trackingAgreed = false;
      this.dataShared = false;
      this.showTermsError = false;
    },
  },
  watch: {
    termsConsented(newValue) {
      if (newValue) {
        this.showTermsError = false;
      }
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
