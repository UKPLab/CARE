<template>
        <div class="border-top pt-3 mt-4">
          <h6 class="step-group-heading text-muted border-bottom pb-1 mb-3">Send test email</h6>
          <p class="small text-muted mb-2">
            Sends a short fixed message so you can verify delivery before finishing setup.
          </p>
          <div class="row my-2">
            <label class="col-md-4 col-form-label text-md-end" for="setup-test-mail-to">Recipient</label>
            <div class="col-md-6 d-flex flex-column flex-sm-row gap-2 align-items-sm-start">
              <input
                id="setup-test-mail-to"
                v-model="testMailTo"
                class="form-control"
                type="email"
                placeholder="you@example.com"
                autocomplete="email"
              />
              <BasicButton
                class="btn btn-outline-primary flex-shrink-0"
                :title="testMailSending ? 'Sending...' : 'Send test email'"
                :disabled="testMailSending || !testMailTo.trim()"
                @click="sendSetupTestMail"
              />
            </div>
          </div>
          <p v-if="testMailMessage" class="small mb-0" :class="testMailError ? 'text-danger' : 'text-success'">
            {{ testMailMessage }}
          </p>
        </div>
</template>
<script>
import BasicButton from '@/basic/Button.vue';
import axios from 'axios';
import getServerURL from '@/assets/serverUrl';
export default {
 name: 'SetupWizardTestMail', components: {BasicButton}, props: {formSettings: {type: Object, required: true}},
 data() {return {testMailTo: '', testMailSending: false, testMailMessage: '', testMailError: false};},
 methods: {mailSettingsPayloadFromForm() {
      const settings = {};
      for (const [k, v] of Object.entries(this.formSettings || {})) {
        if (k.startsWith("system.mailService.")) {
          settings[k] = v === null || v === undefined ? "" : String(v);
        }
      }
      return settings;
    },
    async sendSetupTestMail() {
      const to = (this.testMailTo || "").trim();
      if (!to) return;
      this.testMailSending = true;
      this.testMailMessage = "";
      this.testMailError = false;
      try {
        const res = await axios.post(
          getServerURL() + "/setup/test-mail",
          { to, settings: this.mailSettingsPayloadFromForm() },
          {
            withCredentials: true,
            validateStatus: (status) => status === 200 || (status >= 400 && status < 500),
          }
        );
        if (res.status === 200 && res.data && res.data.success) {
          this.testMailMessage = res.data.message || "Test email sent.";
          this.testMailError = false;
        } else {
          this.testMailError = true;
          this.testMailMessage = (res.data && res.data.message) || "Failed to send test email.";
        }
      } catch (err) {
        this.testMailError = true;
        this.testMailMessage = err?.response?.data?.message || err.message || "Failed to send test email.";
      } finally {
        this.testMailSending = false;
      }
    },
  },
};
</script>