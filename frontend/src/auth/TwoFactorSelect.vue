<template>
  <AuthLayout :title="$t('auth.twoFactor.select.title')">
    <form novalidate @submit.prevent="submitSelection">
      <p v-if="showError" class="text-danger text-center">
        {{ errorMessage }}
      </p>

      <div class="text-center mb-3">
        <p class="text-muted mb-1">
          {{ $t("auth.twoFactor.select.description") }}
        </p>
        <p class="text-muted small mb-0">
          {{ $t("auth.twoFactor.select.instruction") }}
        </p>
      </div>

      <div class="method-list">
        <div
          v-for="method in methods"
          :key="method"
          class="method-card"
          :class="{ selected: selectedMethod === method }"
          @click="selectedMethod = method"
        >
          <div class="d-flex align-items-start">
            <input
              :id="`method-${method}`"
              v-model="selectedMethod"
              class="form-check-input me-3 mt-1"
              type="radio"
              name="twoFactorMethod"
              :value="method"
            />
            <div class="flex-grow-1">
              <label
                class="form-check-label fw-bold"
                :for="`method-${method}`"
              >
                {{ getMethodLabel(method) }}
              </label>
              <p class="text-muted small mb-0">
                {{ getMethodDescription(method) }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="my-4 text-center">
        <BasicButton
          class="btn btn-primary w-100"
          type="submit"
          :disabled="!selectedMethod"
          :loading="isSubmitting"
          :text="isSubmitting ? $t('auth.twoFactor.select.continuing') : $t('common.continue')"
        />
        <BasicButton
          class="btn btn-link"
          :title="$t('common.cancel')"
          @click="cancel"
        />
      </div>

      <div class="text-center text-muted small">
        <p class="mb-0">
          {{ $t("auth.twoFactor.select.profileHint") }}
        </p>
      </div>
    </form>
  </AuthLayout>
</template>

<script>
/**
 * TwoFactorSelect Component
 * 
 * @author: Linyin Huang
 * 
 */
import AuthLayout from "@/auth/AuthLayout.vue";
import BasicButton from "@/basic/Button.vue";
import axios from "axios";
import getServerURL from "@/assets/serverUrl";
import { resolveApiMessage } from "@/assets/utils";

export default {
  name: "TwoFactorSelect",
  components: { AuthLayout, BasicButton },
  data() {
    return {
      methods: [],
      selectedMethod: "",
      isSubmitting: false,
      showError: false,
      errorMessage: "",
    };
  },
  created() {
    this.initMethodsFromQuery();
  },
  methods: {
    initMethodsFromQuery() {
      const raw = this.$route.query.methods;
      if (typeof raw === "string" && raw.length > 0) {
        this.methods = raw.split(",").filter((m) => !!m);
      }
      // Fallback: just support email/totp if nothing present
      if (!this.methods.length) {
        this.methods = ["email", "totp"];
      }
      // Preselect first method for convenience
      if (this.methods.length) {
        this.selectedMethod = this.methods[0];
      }
    },
    getMethodLabel(method) {
      if (method === "email") return this.$t("auth.twoFactor.select.methods.email.label");
      if (method === "totp") return this.$t("auth.twoFactor.select.methods.totp.label");
      return method;
    },
    getMethodDescription(method) {
      if (method === "email") {
        return this.$t("auth.twoFactor.select.methods.email.description");
      }
      if (method === "totp") {
        return this.$t("auth.twoFactor.select.methods.totp.description");
      }
      return this.$t("auth.twoFactor.select.methods.fallbackDescription");
    },
    async submitSelection() {
      if (!this.selectedMethod) {
        this.showError = true;
        this.errorMessage = this.$t("auth.twoFactor.select.errors.selectMethod");
        return;
      }

      this.isSubmitting = true;
      this.showError = false;
      this.errorMessage = "";

      try {
        const response = await axios.post(
          getServerURL() + "/auth/2fa/select",
          { method: this.selectedMethod },
          {
            validateStatus(status) {
              return status === 200 || status === 400 || status === 401;
            },
            withCredentials: true,
          },
        );

        if (response.status !== 200) {
          this.showError = true;
          this.errorMessage = resolveApiMessage(
            response.data,
            "auth.twoFactor.select.errors.startFailed",
          );
          return;
        }

        const method = response.data.method || this.selectedMethod;

        if (method === "email") {
          await this.$router.push({
            name: "2fa-verify-email",
            query: {
              redirectedFrom: this.$route.query.redirectedFrom,
            },
          });
          return;
        }

        if (method === "totp") {
          await this.$router.push({
            name: "2fa-verify-totp",
            query: {
              redirectedFrom: this.$route.query.redirectedFrom,
            },
          });
          return;
        }

        this.showError = true;
        this.errorMessage =
          this.$t("auth.twoFactor.select.errors.unsupportedMethod");
      } catch (error) {
        this.showError = true;
        this.errorMessage = resolveApiMessage(
          error.response?.data,
          "auth.twoFactor.select.errors.startFailedRetry",
        );
      } finally {
        this.isSubmitting = false;
      }
    },
    cancel() {
      this.$router.push({ name: "login" });
    },
  },
};
</script>

<style scoped>
.method-list {
  margin-top: 8px;
}

.method-card {
  border: 1px solid var(--bs-border-color);
  border-radius: var(--bs-border-radius-lg);
  padding: 14px 16px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: background-color var(--care-dur-fast) var(--care-ease),
              border-color var(--care-dur-fast) var(--care-ease),
              box-shadow var(--care-dur-fast) var(--care-ease);
}

.method-card:hover {
  background-color: var(--bs-tertiary-bg);
}

.method-card.selected {
  border-color: var(--care-primary);
  background-color: color-mix(in srgb, var(--care-primary) 6%, var(--bs-body-bg));
  box-shadow: var(--care-focus-ring);
}
</style>
