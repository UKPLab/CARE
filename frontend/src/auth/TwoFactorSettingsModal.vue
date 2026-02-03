<template>
  <BasicModal
    ref="modal"
    size="lg"
    name="TwoFactorSettingsModal"
    @hide="resetForm"
  >
    <template #title>
      <span>Two-Factor Authentication Settings</span>
    </template>
    <template #body>
      <!-- Loading State -->
      <div v-if="isLoading" class="text-center py-4">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="text-muted mt-2">Loading...</p>
      </div>

      <!-- Main Content -->
      <div v-else>
        <!-- Current Status -->
        <div v-if="!twoFactorEnabled" class="alert alert-info">
          <i class="bi bi-info-circle"></i>
          <strong>Current Status:</strong> 2FA is disabled
        </div>
        <div v-else class="alert alert-success">
          <i class="bi bi-shield-check"></i>
          <strong>Current Status:</strong> 2FA is enabled
        </div>

        <!-- 2FA Disabled State -->
        <div v-if="!twoFactorEnabled">
          <p class="text-muted mb-3">
            Choose a verification method to secure your account
          </p>

          <!-- Method Selection -->
          <div class="method-selection">
            <!-- Email Method -->
            <div
              class="method-card"
              :class="{ selected: selectedMethod === 'email' }"
              @click="selectMethod('email')"
            >
              <div class="d-flex align-items-start">
                <input
                  id="method-email"
                  v-model="selectedMethod"
                  class="form-check-input me-3 mt-1"
                  type="radio"
                  name="method"
                  value="email"
                />
                <div class="flex-grow-1">
                  <label class="form-check-label fw-bold" for="method-email">
                    Email Verification
                  </label>
                  <p class="text-muted small mb-2">
                    Receive a 6-digit code via email when logging in
                  </p>
                  <span class="badge bg-success">Recommended</span>
                </div>
              </div>
            </div>

            <!-- ORCID Method -->
            <div
              class="method-card"
              :class="{ selected: selectedMethod === 'orcId' }"
              @click="selectMethod('orcId')"
            >
              <div class="d-flex align-items-start">
                <input
                  id="method-orcid"
                  v-model="selectedMethod"
                  class="form-check-input me-3 mt-1"
                  type="radio"
                  name="method"
                  value="orcId"
                />
                <div class="flex-grow-1">
                  <label class="form-check-label fw-bold" for="method-orcid">
                    ORCID Authentication
                  </label>
                  <p class="text-muted small mb-2">
                    Verify your identity using your ORCID id
                  </p>
                  <span class="badge bg-info">Requires ORCID account</span>
                </div>
              </div>
            </div>

            <!-- LDAP Method -->
            <div
              class="method-card"
              :class="{ selected: selectedMethod === 'ldapauth' }"
              @click="selectMethod('ldapauth')"
            >
              <div class="d-flex align-items-start">
                <input
                  id="method-ldap"
                  v-model="selectedMethod"
                  class="form-check-input me-3 mt-1"
                  type="radio"
                  name="method"
                  value="ldapauth"
                />
                <div class="flex-grow-1">
                  <label class="form-check-label fw-bold" for="method-ldap">
                    Institutional Authentication (LDAP)
                  </label>
                  <p class="text-muted small mb-2">
                    Verify using your institutional credentials
                  </p>
                  <span class="badge bg-info">For institutional users</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Method-specific Setup -->
          <div v-if="selectedMethod" class="setup-section mt-3">
            <!-- Email Setup -->
            <div v-if="selectedMethod === 'email'" class="setup-info">
              <div class="alert alert-success">
                <i class="bi bi-check-circle"></i>
                No additional setup required for email verification
              </div>
              <p class="small text-muted mb-0">
                Codes will be sent to:
                <strong>{{ userEmail || "Not set" }}</strong>
              </p>
              <div v-if="!hasEmail" class="alert alert-warning mt-2">
                <i class="bi bi-exclamation-triangle"></i>
                You need to add and verify an email address in your profile
                first
              </div>
            </div>

            <!-- ORCID Setup -->
            <div v-if="selectedMethod === 'orcId'" class="setup-info">
              <div v-if="!orcidLinked">
                <p class="small text-muted mb-2">
                  You need to link your ORCID account first
                </p>
                <button
                  type="button"
                  class="btn btn-outline-success w-100"
                  :disabled="isLinking"
                  @click="linkOrcid"
                >
                  <i class="bi bi-link-45deg"></i>
                  {{ isLinking ? "Linking..." : "Link ORCID Account" }}
                </button>
                <div class="form-text">
                  You will be redirected to ORCID.org to authorize
                </div>
              </div>
              <div v-else class="alert alert-success">
                <i class="bi bi-check-circle"></i>
                ORCID linked: {{ orcidId }}
              </div>
            </div>

            <!-- LDAP Setup -->
            <div v-if="selectedMethod === 'ldapauth'" class="setup-info">
              <div class="mb-3">
                <label class="form-label">
                  Institutional Domain
                  <span class="text-muted small">(Optional)</span>
                </label>
                <input
                  v-model="ldapDomain"
                  type="text"
                  class="form-control"
                  placeholder="e.g., university.edu"
                />
                <div class="form-text">
                  Enter your institution's domain to simplify login
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 2FA Enabled State -->
        <div v-else>
          <div class="current-method-info">
            <h6>Currently Active Method</h6>

            <!-- Email Info -->
            <div v-if="currentMethod === 'email'" class="card">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <div class="fw-bold">Email Verification</div>
                    <div class="text-muted small">
                      Codes sent to: {{ userEmail }}
                    </div>
                  </div>
                  <span class="badge bg-success">Active</span>
                </div>
              </div>
            </div>

            <!-- ORCID Info -->
            <div v-if="currentMethod === 'orcId'" class="card">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-start">
                  <div class="flex-grow-1">
                    <div class="fw-bold">ORCID Authentication</div>
                    <div class="text-muted small">
                      <i class="bi bi-link-45deg"></i>
                      Linked ORCID: {{ orcidId }}
                    </div>
                  </div>
                  <span class="badge bg-success">Active</span>
                </div>
                <button
                  type="button"
                  class="btn btn-outline-danger btn-sm mt-3 w-100"
                  :disabled="isSubmitting"
                  @click="unlinkOrcid"
                >
                  <i class="bi bi-link-45deg"></i>
                  {{ isSubmitting ? "Unlinking..." : "Unlink ORCID" }}
                </button>
              </div>
            </div>

            <!-- LDAP Info -->
            <div v-if="currentMethod === 'ldapauth'" class="card">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <div class="fw-bold">
                      Institutional Authentication (LDAP)
                    </div>
                    <div v-if="ldapDomain" class="text-muted small">
                      Domain: {{ ldapDomain }}
                    </div>
                  </div>
                  <span class="badge bg-success">Active</span>
                </div>
              </div>
            </div>

            <!-- How it works -->
            <div class="alert alert-light mt-3">
              <h6 class="alert-heading">
                <i class="bi bi-info-circle"></i>
                How it works
              </h6>
              <p class="small mb-0">
                {{ getMethodDescription(currentMethod) }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <span class="btn-group">
        <BasicButton
          title="Cancel"
          class="btn btn-secondary"
          @click="$refs.modal.close()"
        />
        <BasicButton
          v-if="!twoFactorEnabled"
          title="Enable 2FA"
          class="btn btn-primary"
          :disabled="!canEnable || isSubmitting"
          @click="enable2FA"
        />
        <BasicButton
          v-else
          title="Disable 2FA"
          class="btn btn-danger"
          :disabled="isSubmitting"
          @click="disable2FA"
        />
      </span>
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import axios from "axios";
import getServerURL from "@/assets/serverUrl";

/**
 * Modal for managing two-factor authentication settings
 *
 * @author: Linyin Huang
 */
export default {
  name: "TwoFactorSettingsModal",
  components: { BasicModal, BasicButton },
  data() {
    return {
      // Loading states
      isLoading: false,
      isSubmitting: false,
      isLinking: false,

      // 2FA state
      twoFactorEnabled: false,
      currentMethod: "",
      orcidId: "",
      ldapDomain: "",

      // Setup
      selectedMethod: "email", // default
      orcidLinked: false,
    };
  },
  computed: {
    user() {
      return this.$store.getters["auth/getUser"];
    },
    userEmail() {
      return this.user.email;
    },
    hasEmail() {
      return !!this.userEmail;
    },
    canEnable() {
      if (!this.selectedMethod) return false;

      if (this.selectedMethod === "email") {
        return this.hasEmail;
      }

      if (this.selectedMethod === "orcId") {
        return this.orcidLinked;
      }

      // LDAP can be enabled without domain
      if (this.selectedMethod === "ldapauth") {
        return true;
      }

      return false;
    },
  },
  methods: {
    async open() {
      await this.load2FAStatus();
      this.$refs.modal.open();
    },
    async load2FAStatus() {
      this.isLoading = true;

      try {
        const response = await axios.get(getServerURL() + "/auth/2fa/status", {
          withCredentials: true,
        });

        if (response.status === 200) {
          this.twoFactorEnabled = response.data.twoFactorEnabled || false;
          this.currentMethod = response.data.twoFactorMethod;
          this.orcidId = response.data.orcidId || "";
          this.ldapDomain = response.data.ldapDomain || "";

          // Check if ORCID is linked
          this.orcidLinked = !!this.orcidId;
        }
      } catch (error) {
        this.eventBus.emit("toast", {
          title: "Failed to load 2FA settings",
          message:
            error.response?.data?.message ||
            "An error occurred while loading 2FA settings",
          variant: "danger",
        });
      } finally {
        this.isLoading = false;
      }
    },
    selectMethod(method) {
      this.selectedMethod = method;
    },
    async linkOrcid() {
      this.isLinking = true;

      try {
        // Redirect to ORCID linking endpoint
        window.location.href = getServerURL() + "/auth/orcid/link";
      } catch (error) {
        this.eventBus.emit("toast", {
          title: "Failed to link ORCID",
          message:
            error.response?.data?.message ||
            "An error occurred while linking ORCID",
          variant: "danger",
        });
        this.isLinking = false;
      }
    },
    async unlinkOrcid() {
      if (!confirm("Are you sure you want to unlink your ORCID account?")) {
        return;
      }

      this.isSubmitting = true;

      try {
        const response = await axios.post(
          getServerURL() + "/auth/orcid/unlink",
          {},
          {
            validateStatus: (status) => status === 200 || status === 400,
            withCredentials: true,
          },
        );

        if (response.status === 200) {
          this.eventBus.emit("toast", {
            title: "ORCID unlinked",
            message: "Your ORCID account has been successfully unlinked",
            variant: "success",
          });

          // Reload status
          setTimeout(async () => {
            await this.load2FAStatus();
          }, 1500);
        } else {
          this.eventBus.emit("toast", {
            title: "Failed to unlink ORCID",
            message: response.data.message || "Failed to unlink ORCID account",
            variant: "danger",
          });
        }
      } catch (error) {
        this.eventBus.emit("toast", {
          title: "Failed to unlink ORCID",
          message:
            error.response?.data?.message ||
            "An error occurred while unlinking ORCID",
          variant: "danger",
        });
      } finally {
        this.isSubmitting = false;
      }
    },
    async enable2FA() {
      if (!this.canEnable) return;

      this.isSubmitting = true;

      try {
        const payload = {
          method: this.selectedMethod,
        };

        // Add method-specific data
        if (this.selectedMethod === "ldapauth" && this.ldapDomain) {
          payload.ldapDomain = this.ldapDomain;
        }

        const response = await axios.post(
          getServerURL() + "/auth/2fa/enable",
          payload,
          {
            validateStatus: (status) => status === 200 || status === 400,
            withCredentials: true,
          },
        );

        if (response.status === 200) {
          this.eventBus.emit("toast", {
            title: "2FA enabled",
            message: "Two-factor authentication has been successfully enabled!",
            variant: "success",
          });

          // Reload status
          setTimeout(async () => {
            await this.load2FAStatus();
          }, 1500);
        } else {
          this.eventBus.emit("toast", {
            title: "Failed to enable 2FA",
            message:
              response.data.message ||
              "Failed to enable two-factor authentication",
            variant: "danger",
          });
        }
      } catch (error) {
        this.eventBus.emit("toast", {
          title: "Failed to enable 2FA",
          message:
            error.response?.data?.message ||
            "An error occurred while enabling 2FA",
          variant: "danger",
        });
      } finally {
        this.isSubmitting = false;
      }
    },
    async disable2FA() {
      if (
        !confirm(
          "Are you sure you want to disable Two-Factor Authentication? This will reduce your account security.",
        )
      ) {
        return;
      }

      this.isSubmitting = true;

      try {
        const response = await axios.post(
          getServerURL() + "/auth/2fa/disable",
          {},
          {
            validateStatus: (status) => status === 200 || status === 400,
            withCredentials: true,
          },
        );

        if (response.status === 200) {
          this.eventBus.emit("toast", {
            title: "2FA disabled",
            message: "Two-factor authentication has been disabled",
            variant: "success",
          });

          // Reload status and close modal
          setTimeout(async () => {
            await this.load2FAStatus();
            this.$refs.modal.close();
          }, 1500);
        } else {
          this.eventBus.emit("toast", {
            title: "Failed to disable 2FA",
            message:
              response.data.message ||
              "Failed to disable two-factor authentication",
            variant: "danger",
          });
        }
      } catch (error) {
        this.eventBus.emit("toast", {
          title: "Failed to disable 2FA",
          message:
            error.response?.data?.message ||
            "An error occurred while disabling 2FA",
          variant: "danger",
        });
      } finally {
        this.isSubmitting = false;
      }
    },
    resetForm() {
      this.selectedMethod = "email";
      this.ldapDomain = "";
      this.orcidLinked = false;
    },
    getMethodDescription(method) {
      const descriptions = {
        email:
          "When logging in, a 6-digit verification code will be sent to your email",
        orcId:
          "When logging in, you will be redirected to ORCID.org for authentication",
        ldapauth:
          "When logging in, you will need to enter your institutional credentials",
      };
      return descriptions[method] || "";
    },
  },
};
</script>

<style scoped>
.method-card {
  border: 2px solid #dee2e6;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.method-card:hover {
  background-color: #f8f9fa;
  border-color: #0d6efd;
}

.method-card.selected {
  border-color: #0d6efd;
  background-color: #e7f1ff;
}

.setup-section {
  background-color: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.setup-info {
  margin-top: 8px;
}

.current-method-info .card {
  border: 1px solid #dee2e6;
}
</style>
