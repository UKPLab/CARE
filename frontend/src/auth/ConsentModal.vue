<template>
  <Modal
    ref="modal"
    size="xl"
    name="terms"
    disable-keyboard
    remove-close
    @show="handleModalShow"
    @hide="handleModalHide"
  >
    <template #title>{{ $t('auth.termsOfService') }}</template>
    <template #body>
      <div class="terms-wrapper" :class="{ 'is-bottom': isAtBottom }">
        <div 
          ref="termsContainer" 
          class="terms-container"
          @scroll="checkScrollPosition"
        >
          <BasicEditor :model-value="terms" :read-only="true" />
        </div>
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
      <div class="button-group">
        <button
          type="button"
          class="btn btn-secondary"
          @click="handleDecline"
        >
          {{ $t('common.decline') }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          @click="handleAccept"
        >
          {{ $t('auth.acceptAndContinue') }}
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
import BasicEditor from "@/basic/editor/Editor.vue";
import { resolveApiMessage } from "@/assets/utils";

export default {
  name: "ConsentModal",
  components: {Modal, BasicEditor},
  data() {
    return {
      acceptStats: false,
      acceptDataSharing: false,
      isAtBottom: false,
      modalVisible: false,
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
      if (this.modalVisible) {
        return;
      }
      this.$refs.modal.open();
      this.$nextTick(() => {
        // Check if content needs scrolling upon opening the modal
        this.checkScrollPosition();
      });
    },
    close() {
      if (this.modalVisible) {
        this.$refs.modal.close();
      }
    },
    // Public method
    isVisible() {
      return this.modalVisible;
    },
    checkScrollPosition() {
      const container = this.$refs.termsContainer;
      if (!container) return;
      
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      
      // Check if content needs scrolling
      if (scrollHeight <= clientHeight) {
        this.isAtBottom = true;
        return;
      }
      
      // Check if scrolled to bottom
      this.isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 10;
    },
    async handleDecline() {
      this.resetForm();
      this.close();
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
          this.close();
          this.$store.commit("auth/SET_USER", res.data);
          this.eventBus.emit("toast", {
            title: this.$t('auth.messages.termsUpdated'),
            message: this.$t('auth.messages.termsUpdatedMessage'),
            variant: "success",
          });
        } else {
          this.eventBus.emit("toast", {
            title: this.$t('errors.auth.termsUpdateError'),
            message: resolveApiMessage(res),
            variant: "danger",
          });
        }
      });
    },
    resetForm() {
      this.acceptStats = false;
      this.acceptDataSharing = false;
    },
    handleModalShow() {
      this.modalVisible = true;
    },
    handleModalHide() {
      this.modalVisible = false;
    },
  },
};
</script>

<style scoped>
.terms-wrapper {
  position: relative;
  height: 400px;
  margin-bottom: 15px;
  &::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 20px;
    background: linear-gradient(to bottom, transparent, white);
    pointer-events: none;
    border-radius: 0 0 4px 4px;
    transition: opacity 0.2s ease;
  }
  
  &.is-bottom::after {
    opacity: 0;
  }
}

.terms-container {
  height: 100%;
  overflow-y: auto;
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
