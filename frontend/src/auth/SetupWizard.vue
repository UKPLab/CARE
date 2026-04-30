<template>
  <div class="setup-wizard">
    <div class="col-md-10 mx-auto my-4">
      <div class="text-center mb-4">
        <IconAsset :height="160" name="logo" />
      </div>

      <!-- Stepper -->
      <div v-if="displaySteps.length" class="stepper mb-4">
        <div
          v-for="(step, index) in displaySteps"
          :key="step.key"
          :class="{ active: currentStep === index }"
          :data-index="index + 1"
        >
          {{ step.title }}
        </div>
      </div>

      <!-- Step: Admin -->
      <div v-show="displaySteps[currentStep]?.type === 'admin'" class="card">
        <div class="card-header step-card-header">Setup – Admin account</div>
        <div class="card-body mx-4 my-4">
          <p class="text-muted mb-3">
            No administrator account exists. Enter credentials now; the account is created on Finish.
          </p>
          <p v-if="showError" class="text-danger text-center">{{ errorMessage }}</p>
          <form @submit.prevent="submitAdmin">
            <div class="form-group row my-2">
              <label class="col-md-4 col-form-label text-md-right" for="setup-username">Username</label>
              <div class="col-md-6">
                <input
                  id="setup-username"
                  v-model="formData.userName"
                  autocomplete="username"
                  class="form-control"
                  placeholder="admin"
                  type="text"
                  @blur="checkVal('userName')"
                />
                <div class="feedback-invalid" :class="{invalid: validity['userName'] && !validUserName}">
                  Please provide a user name.
                </div>
              </div>
            </div>
            <div class="form-group row my-2">
              <label class="col-md-4 col-form-label text-md-right" for="setup-email">Email</label>
              <div class="col-md-6">
                <input
                  id="setup-email"
                  v-model="formData.email"
                  autocomplete="email"
                  class="form-control"
                  placeholder="admin@example.com"
                  type="email"
                  @blur="checkVal('email')"
                />
                <div class="feedback-invalid" :class="{invalid: validity['email'] && !validEmail}">
                  Please provide a valid email.
                </div>
              </div>
            </div>
            <div class="form-group row my-2">
              <label class="col-md-4 col-form-label text-md-right" for="setup-password">Password</label>
              <div class="col-md-6">
                <input
                  id="setup-password"
                  v-model="formData.password"
                  autocomplete="new-password"
                  class="form-control"
                  placeholder="Min. 8 characters"
                  type="password"
                  @blur="checkVal('password')"
                />
                <div class="feedback-invalid" :class="{invalid: validity['password'] && !validPassword}">
                  Please provide a password of at least 8 characters.
                </div>
              </div>
            </div>
            <div class="col-md-6 offset-md-4 my-4">
              <BasicButton class="btn btn-primary" title="Continue" @click="submitAdmin" />
            </div>
          </form>
        </div>
      </div>

      <!-- Step: General -->
      <div v-show="displaySteps[currentStep]?.type === 'general'" class="card">
        <div class="card-header step-card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
          <span>General Settings</span>
          <div class="d-flex flex-wrap gap-2">
            <BasicButton
              class="btn btn-outline-secondary btn-sm"
              text="Download template"
              :disabled="!allSettingsLoaded"
              :tooltip="allSettingsLoaded ? 'Download JSON: full settings snapshot with current wizard values applied' : 'Available after settings load'"
              @click="downloadImportTemplate"
            />
            <BasicButton
              class="btn btn-outline-secondary btn-sm"
              text="Import from previous instance"
              tooltip="Load settings from a JSON file exported from another CARE instance"
              @click="openImportModal"
            />
          </div>
        </div>
        <div class="card-body mx-4 my-4">
          <p v-if="showError" class="text-danger text-center">{{ errorMessage }}</p>

          <template v-if="settingsFromFile && Object.keys(settingsFromFile).length > 0">
            <p class="text-success mb-2">
              Loaded {{ Object.keys(settingsFromFile).length }} setting(s) from file. Click Next to continue to the summary.
            </p>
            <button
              class="btn btn-link btn-sm p-0 text-secondary"
              type="button"
              @click="clearImport"
            >
              Clear and configure manually instead
            </button>
          </template>
          <template v-else>
            <p class="text-muted mb-3">
              Configure copyright notice, consent requirements, guest access, and links shown on the landing page.
            </p>

            <div v-for="group in generalFieldGroups" :key="group.title" class="mb-4">
              <h6 v-if="group.title" class="step-group-heading text-muted border-bottom pb-1 mb-3">
                {{ group.title }}
              </h6>
              <div
                v-for="s in group.settings"
                :key="s.key"
                class="form-group row my-2"
              >
                <label
                  class="col-md-4 col-form-label text-md-right"
                  :for="'set-' + s.key"
                  @click="(s.type === 'boolean' || s.type === 'bool') && $event.preventDefault()"
                >
                  {{ settingLabel(s.key) }}
                </label>
                <div class="col-md-6 d-flex flex-column">
                  <template v-if="s.type === 'boolean' || s.type === 'bool'">
                    <div class="form-check form-switch">
                      <input
                        :id="'set-' + s.key"
                        :checked="formSettings[s.key] === 'true'"
                        class="form-check-input"
                        type="checkbox"
                        @change="formSettings[s.key] = $event.target.checked ? 'true' : 'false'"
                      />
                    </div>
                  </template>
                  <template v-else-if="s.key === 'app.register.terms'">
                    <div class="d-flex align-items-center flex-wrap gap-2">
                      <EditorModal
                        :model-value="formSettings[s.key]"
                        :title="'Edit ' + settingLabel(s.key)"
                        @update:model-value="formSettings[s.key] = $event"
                      />
                      <span class="small text-muted">Open the editor to change terms and conditions.</span>
                    </div>
                  </template>
                  <template v-else-if="s.type === 'edits'">
                    <textarea
                      :id="'set-' + s.key"
                      v-model="formSettings[s.key]"
                      class="form-control w-100"
                      rows="5"
                    />
                  </template>
                  <input
                    v-else-if="s.type === 'integer'"
                    :id="'set-' + s.key"
                    v-model.number="formSettings[s.key]"
                    class="form-control"
                    type="number"
                  />
                  <input
                    v-else
                    :id="'set-' + s.key"
                    v-model="formSettings[s.key]"
                    class="form-control"
                    type="text"
                  />
                  <div
                    v-if="settingDescription(s.key) || s.description"
                    class="small text-muted mt-1"
                  >
                    {{ settingDescription(s.key) || s.description }}
                  </div>
                </div>
                <div v-if="s.requiredInWizard" class="col-md-6 offset-md-4">
                  <div class="feedback-invalid" :class="{invalid: settingsTouched && !(formSettings[s.key] != null && String(formSettings[s.key]).trim() !== '')}">
                    This field is required.
                  </div>
                </div>
              </div>
            </div>

            <div v-if="moodleSettingsFlat.length" class="mb-4 mt-4">
              <h6 class="step-group-heading text-muted border-bottom pb-1 mb-2">
                Moodle <span class="fw-normal small">(optional)</span>
              </h6>
              <p class="small text-muted mb-3">
                Configure Moodle if you use it for enrollments or submissions. You can change these later under Settings → Moodle.
              </p>
              <div
                v-for="s in moodleSettingsFlat"
                :key="s.key"
                class="form-group row my-2"
              >
                <label
                  class="col-md-4 col-form-label text-md-right"
                  :for="'set-' + s.key"
                  @click="(s.type === 'boolean' || s.type === 'bool') && $event.preventDefault()"
                >
                  {{ settingLabel(s.key) }}
                </label>
                <div class="col-md-6 d-flex flex-column">
                  <template v-if="s.type === 'boolean' || s.type === 'bool'">
                    <div class="form-check form-switch">
                      <input
                        :id="'set-' + s.key"
                        :checked="formSettings[s.key] === 'true'"
                        class="form-check-input"
                        type="checkbox"
                        @change="formSettings[s.key] = $event.target.checked ? 'true' : 'false'"
                      />
                    </div>
                  </template>
                  <input
                    v-else-if="s.type === 'integer'"
                    :id="'set-' + s.key"
                    v-model.number="formSettings[s.key]"
                    class="form-control"
                    type="number"
                  />
                  <input
                    v-else
                    :id="'set-' + s.key"
                    v-model="formSettings[s.key]"
                    class="form-control"
                    type="text"
                  />
                  <div
                    v-if="settingDescription(s.key) || s.description"
                    class="small text-muted mt-1"
                  >
                    {{ settingDescription(s.key) || s.description }}
                  </div>
                </div>
              </div>
            </div>
          </template>

          <div class="d-flex justify-content-between mt-4">
            <BasicButton v-if="currentStep > 0" class="btn btn-secondary" title="Previous" @click="onPrevious" />
            <BasicButton
              class="btn btn-primary"
              :class="{ 'ms-auto': currentStep === 0 }"
              title="Next"
              @click="onStepNext"
            />
          </div>
        </div>
      </div>

      <!-- Step: Mail -->
      <div v-show="displaySteps[currentStep]?.type === 'mail'" class="card">
        <div class="card-header step-card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
          <span>Mail Configuration</span>
          <div class="d-flex flex-wrap gap-2">
            <BasicButton
              class="btn btn-outline-secondary btn-sm"
              text="Download template"
              :disabled="!allSettingsLoaded"
              :tooltip="allSettingsLoaded ? 'Download JSON: full settings snapshot with current wizard values applied' : 'Available after settings load'"
              @click="downloadImportTemplate"
            />
            <BasicButton
              class="btn btn-outline-secondary btn-sm"
              text="Import from previous instance"
              tooltip="Load settings from a JSON file exported from another CARE instance"
              @click="openImportModal"
            />
          </div>
        </div>
        <div class="card-body mx-4 my-4">
          <p v-if="showError" class="text-danger text-center">{{ errorMessage }}</p>

          <div class="form-check form-switch mb-3">
            <input
              id="mail-enabled"
              :checked="formSettings['system.mailService.enabled'] === 'true'"
              class="form-check-input"
              type="checkbox"
              @change="formSettings['system.mailService.enabled'] = $event.target.checked ? 'true' : 'false'"
            />
            <label class="form-check-label" for="mail-enabled" @click.prevent>
              Enable email service (required for password reset and email verification)
            </label>
          </div>

          <template v-if="mailEnabled">
            <div v-for="group in mailFieldGroups" :key="group.title" class="mb-4">
              <h6 v-if="group.title" class="step-group-heading text-muted border-bottom pb-1 mb-3">
                {{ group.title }}
              </h6>
              <div
                v-for="s in group.settings"
                :key="s.key"
                class="form-group row my-2"
              >
                <label
                  class="col-md-4 col-form-label text-md-right"
                  :for="'set-' + s.key"
                  @click="(s.type === 'boolean' || s.type === 'bool') && $event.preventDefault()"
                >
                  {{ settingLabel(s.key) }}
                </label>
                <div class="col-md-6 d-flex flex-column">
                  <template v-if="s.type === 'boolean' || s.type === 'bool'">
                    <div class="form-check form-switch">
                      <input
                        :id="'set-' + s.key"
                        :checked="formSettings[s.key] === 'true'"
                        class="form-check-input"
                        type="checkbox"
                        @change="onMailSettingChange(s.key, $event.target.checked ? 'true' : 'false')"
                      />
                    </div>
                  </template>
                  <template v-else-if="s.type === 'edits'">
                    <textarea
                      :id="'set-' + s.key"
                      v-model="formSettings[s.key]"
                      class="form-control w-100"
                      rows="4"
                    />
                  </template>
                  <input
                    v-else
                    :id="'set-' + s.key"
                    v-model="formSettings[s.key]"
                    class="form-control"
                    type="text"
                  />
                  <div
                    v-if="settingDescription(s.key) || s.description"
                    class="small text-muted mt-1"
                  >
                    {{ settingDescription(s.key) || s.description }}
                  </div>
                </div>
              </div>
            </div>

            <div v-if="mailEnabled" class="border-top pt-3 mt-4">
              <h6 class="step-group-heading text-muted border-bottom pb-1 mb-3">Send test email</h6>
              <p class="small text-muted mb-2">
                Sends a short fixed message so you can verify delivery before finishing setup.
              </p>
              <div class="form-group row my-2">
                <label class="col-md-4 col-form-label text-md-right" for="setup-test-mail-to">Recipient</label>
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

          <div class="d-flex justify-content-between mt-4">
            <BasicButton class="btn btn-secondary" title="Previous" @click="onPrevious" />
            <BasicButton class="btn btn-primary ms-auto" title="Next" @click="onStepNext" />
          </div>
        </div>
      </div>

      <!-- Step: Registration -->
      <div v-show="displaySteps[currentStep]?.type === 'registration'" class="card">
        <div class="card-header step-card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
          <span>User Registration</span>
          <div class="d-flex flex-wrap gap-2">
            <BasicButton
              class="btn btn-outline-secondary btn-sm"
              text="Download template"
              :disabled="!allSettingsLoaded"
              :tooltip="allSettingsLoaded ? 'Download JSON: full settings snapshot with current wizard values applied' : 'Available after settings load'"
              @click="downloadImportTemplate"
            />
            <BasicButton
              class="btn btn-outline-secondary btn-sm"
              text="Import from previous instance"
              tooltip="Load settings from a JSON file exported from another CARE instance"
              @click="openImportModal"
            />
          </div>
        </div>
        <div class="card-body mx-4 my-4">
          <p v-if="showError" class="text-danger text-center">{{ errorMessage }}</p>
          <p class="text-muted mb-3">
            Configure which information and consents are requested from users during registration.
          </p>

          <div v-for="group in registrationFieldGroups" :key="group.title" class="mb-4">
            <h6 v-if="group.title" class="step-group-heading text-muted border-bottom pb-1 mb-3">
              {{ group.title }}
            </h6>
            <div
              v-for="s in group.settings"
              :key="s.key"
              class="form-group row my-2"
            >
              <label
                class="col-md-4 col-form-label text-md-right"
                :for="'set-' + s.key"
                @click="(s.type === 'boolean' || s.type === 'bool') && $event.preventDefault()"
              >
                {{ settingLabel(s.key) }}
              </label>
              <div class="col-md-6 d-flex flex-column">
                <template v-if="s.type === 'boolean' || s.type === 'bool'">
                  <div class="form-check form-switch">
                    <input
                      :id="'set-' + s.key"
                      :checked="formSettings[s.key] === 'true'"
                      class="form-check-input"
                      type="checkbox"
                      @change="formSettings[s.key] = $event.target.checked ? 'true' : 'false'"
                    />
                  </div>
                </template>
                <template v-else-if="s.type === 'edits'">
                  <textarea
                    :id="'set-' + s.key"
                    v-model="formSettings[s.key]"
                    class="form-control w-100"
                    rows="4"
                  />
                </template>
                <input
                  v-else
                  :id="'set-' + s.key"
                  v-model="formSettings[s.key]"
                  class="form-control"
                  type="text"
                />
                <div
                  v-if="settingDescription(s.key) || s.description"
                  class="small text-muted mt-1"
                >
                  {{ settingDescription(s.key) || s.description }}
                </div>
              </div>
            </div>
          </div>

          <div v-if="mailEnabled" class="mb-4">
            <h6 class="step-group-heading text-muted border-bottom pb-1 mb-3">Email verification</h6>
            <div class="form-group row my-2">
              <label class="col-md-4 col-form-label text-md-right" for="email-verification-reg" @click.prevent>
                {{ settingLabel("app.register.emailVerification") }}
              </label>
              <div class="col-md-6 d-flex flex-column">
                <div class="form-check form-switch">
                  <input
                    id="email-verification-reg"
                    :checked="formSettings['app.register.emailVerification'] === 'true'"
                    class="form-check-input"
                    type="checkbox"
                    @change="formSettings['app.register.emailVerification'] = $event.target.checked ? 'true' : 'false'"
                  />
                </div>
                <div class="small text-muted mt-1">
                  Require new users to verify their email address before accessing the application.
                </div>
              </div>
            </div>
          </div>

          <div class="d-flex justify-content-between mt-4">
            <BasicButton class="btn btn-secondary" title="Previous" @click="onPrevious" />
            <BasicButton class="btn btn-primary ms-auto" title="Next" @click="onStepNext" />
          </div>
        </div>
      </div>

      <!-- Step: Summary -->
      <div v-show="displaySteps[currentStep]?.type === 'summary'" class="card">
        <div class="card-header step-card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
          <span>Summary</span>
          <div class="d-flex flex-wrap gap-2">
            <BasicButton
              class="btn btn-outline-secondary btn-sm"
              text="Download template"
              :disabled="!allSettingsLoaded"
              :tooltip="allSettingsLoaded ? 'Download JSON: full settings snapshot with current wizard values applied' : 'Available after settings load'"
              @click="downloadImportTemplate"
            />
            <BasicButton
              class="btn btn-outline-secondary btn-sm"
              text="Import from previous instance"
              tooltip="Load settings from a JSON file exported from another CARE instance"
              @click="openImportModal"
            />
          </div>
        </div>
        <div class="card-body mx-4 my-4">
          <p class="text-muted mb-3">Review your choices before finishing.</p>

          <div v-if="!hasAdmin" class="mb-4">
            <h6 class="step-group-heading text-muted border-bottom pb-1 mb-3">Admin</h6>
            <ul class="list-unstyled mb-0">
              <li><strong>Username:</strong> {{ formData.userName || "—" }}</li>
              <li><strong>Email:</strong> {{ formData.email || "—" }}</li>
              <li><strong>Password:</strong> Password set</li>
            </ul>
          </div>

          <div v-for="group in summaryFieldGroups" :key="group.title" class="mb-4">
            <h6 class="step-group-heading text-muted border-bottom pb-1 mb-3">{{ group.title }}</h6>
            <ul class="list-unstyled ms-2 mb-0">
              <li v-for="s in group.settings" :key="s.key" class="mb-2">
                <template v-if="s.key === 'app.register.terms'">
                  <div class="fw-semibold mb-1">{{ settingLabel(s.key) }}</div>
                  <BasicEditor :model-value="summarySettingValue(s.key)" :read-only="true" />
                </template>
                <template v-else>
                  <strong>{{ settingLabel(s.key) }}:</strong> {{ summarySettingValue(s.key) }}
                </template>
              </li>
            </ul>
          </div>

          <div v-if="settingsFromFile && Object.keys(settingsFromFile).length" class="mt-4">
            <BasicButton
              class="btn btn-link p-0 text-secondary"
              :title="`${showFileSettings ? '▼' : '▶'} Additional settings from file (${Object.keys(settingsFromFile).length})`"
              @click="showFileSettings = !showFileSettings"
            />
            <ul v-show="showFileSettings" class="list-unstyled mt-2 ms-3 small">
              <li v-for="(v, k) in settingsFromFile" :key="k"><strong>{{ k }}:</strong> {{ v }}</li>
            </ul>
          </div>

          <div class="d-flex justify-content-between mt-4">
            <BasicButton v-if="currentStep > 0" class="btn btn-secondary" title="Previous" @click="onPrevious" />
            <BasicButton
              class="btn btn-primary"
              :class="{ 'ms-auto': currentStep === 0 }"
              :title="finishing ? 'Saving…' : 'Finish'"
              :disabled="finishing"
              @click="finish"
            />
          </div>
        </div>
      </div>

      <!-- Import JSON Modal -->
      <Modal ref="importModal" name="wizardImportSettings">
        <template #title>Import JSON from previous instance</template>
        <template #body>
          <p class="mb-3">
            Upload a JSON file exported from another CARE instance
            (<strong>Dashboard → Settings → Export JSON</strong>) or generated by <strong>Download template</strong>.
            Loaded settings replace the corresponding wizard settings and <strong>skip the remaining setup steps</strong>;
            you can still review everything on the <strong>Summary</strong> before finishing.
          </p>
          <input
            ref="jsonFileInput"
            type="file"
            class="form-control"
            accept=".json"
            @change="onJsonFileChange"
          />
          <p v-if="importError" class="text-danger small mt-2 mb-0">{{ importError }}</p>
        </template>
        <template #footer>
          <span class="btn-group">
            <BasicButton
              class="btn btn-secondary"
              title="Close"
              :disabled="importing"
              @click="$refs.importModal.close()"
            />
            <BasicButton
              class="btn btn-primary"
              :title="importing ? 'Importing…' : 'Import'"
              :disabled="!importFile || importing"
              @click="confirmImport"
            />
          </span>
        </template>
      </Modal>
    </div>
  </div>
</template>

<script>
/**
 * First-time setup wizard: Admin, General (optional Moodle + JSON import), Mail, Registration, Summary.
 * Fetches /setup/config for steps and wizardSettings. On Finish, calls settingSave and redirects.
 *
 * @author Mohammad Elwan
 */
import IconAsset from "@/basic/icon/IconAsset.vue";
import BasicButton from "@/basic/Button.vue";
import BasicEditor from "@/basic/editor/Editor.vue";
import EditorModal from "@/basic/editor/Modal.vue";
import Modal from "@/basic/Modal.vue";
import axios from "axios";
import getServerURL from "@/assets/serverUrl";
import {downloadObjectsAs} from "@/assets/utils";

export default {
  name: "SetupWizard",
  components: { IconAsset, BasicButton, BasicEditor, EditorModal, Modal },
  data() {
    return {
      currentStep: 0,
      steps: [],
      wizardSettings: [],
      hasAdmin: false,
      formData: { userName: "admin", email: "", password: "" },
      validity: null,
      formSettings: {},
      settingsFromFile: null,
      importFile: null,
      importing: false,
      importError: null,
      settingsTouched: false,
      showFileSettings: false,
      showError: false,
      errorMessage: "",
      finishing: false,
      allSettingsFromDb: null,
      testMailTo: "",
      testMailSending: false,
      testMailMessage: "",
      testMailError: false,
      subsectionOrder: {
        general: [
          "Copyright and consent",
          "Terms and conditions",
          "Login options",
          "Landing page links",
          "Connection",
          "Course",
          "Show inputs",
        ],
        mail: ["Mail service", "Sendmail", "SMTP", "Base URL and verification"],
        registration: ["Enable registration", "Information requested at registration", "Consent options", "Email verification rate limit"],
      },
    };
  },
  computed: {
    allSettingsLoaded() {
      return Array.isArray(this.allSettingsFromDb);
    },
    validSettingKeys() {
      return Array.isArray(this.allSettingsFromDb)
        ? new Set(this.allSettingsFromDb.map((s) => s.key))
        : null;
    },
    displaySteps() {
      const stepTypes = ["admin", "general", "mail", "registration", "summary"];
      let filtered = this.steps.filter((s) => stepTypes.includes(s.type));
      if (this.hasAdmin) {
        filtered = filtered.filter((s) => s.type !== "admin");
      }
      if (this.settingsFromFile && Object.keys(this.settingsFromFile).length > 0) {
        filtered = filtered.filter((s) => !["mail", "registration"].includes(s.type));
      }
      return filtered;
    },
    generalFieldGroups() {
      return this.fieldGroupsForStep("general");
    },
    moodleSettingsFlat() {
      const list = (this.wizardSettings || []).filter((s) => s.wizardStep === "moodle");
      return [...list].sort((a, b) => (a.wizardOrder || 0) - (b.wizardOrder || 0));
    },
    mailEnabled() {
      return this.formSettings["system.mailService.enabled"] === "true";
    },
    mailFieldGroups() {
      const sendmailEnabled = this.formSettings["system.mailService.sendMail.enabled"] === "true";
      const smtpEnabled = this.formSettings["system.mailService.smtp.enabled"] === "true";
      const sendmailKey = "system.mailService.sendMail.enabled";
      const smtpKey = "system.mailService.smtp.enabled";

      const groups = this.fieldGroupsForStep("mail")
        .map((g) => ({
          ...g,
          settings: (g.settings || []).filter((s) => s.key !== "system.mailService.enabled"),
        }))
        .filter((g) => g.settings.length > 0);

      const filteredGroups = groups.filter((g) => {
        if (sendmailEnabled && g.title === "SMTP") return false;
        if (smtpEnabled && g.title === "Sendmail") return false;
        return true;
      });

      const normalizedGroups = filteredGroups
        .map((g) => {
          if (g.title === "Sendmail" && !sendmailEnabled) {
            return { ...g, settings: g.settings.filter((s) => s.key === sendmailKey) };
          }
          if (g.title === "SMTP" && !smtpEnabled) {
            return { ...g, settings: g.settings.filter((s) => s.key === smtpKey) };
          }
          return g;
        })
        .filter((g) => g.settings.length > 0);

      const forgotPassword = (this.wizardSettings || []).find((s) => s.key === "app.login.forgotPassword");
      if (forgotPassword && this.mailEnabled) {
        normalizedGroups.push({ title: "Features that use email", settings: [forgotPassword] });
      }
      return normalizedGroups;
    },
    registrationFieldGroups() {
      return this.fieldGroupsForStep("registration").map((g) => ({
        ...g,
        settings: (g.settings || []).filter((s) => s.key !== "app.register.terms"),
      })).filter((g) => g.settings.length > 0);
    },
    summaryFieldGroups() {
      const stepTitles = {
        general: "General",
        mail: "Mail",
        registration: "Registration",
        moodle: "Moodle",
      };
      const byStep = {};
      for (const s of this.wizardSettings || []) {
        const step = s.wizardStep || "general";
        if (!byStep[step]) byStep[step] = [];
        byStep[step].push(s);
      }
      const order = ["general", "mail", "registration", "moodle"];
      return order.filter((step) => byStep[step]?.length).map((step) => ({
        title: stepTitles[step],
        settings: byStep[step],
      }));
    },
    validUserName() {
      return typeof this.formData.userName === "string" && this.formData.userName.trim() !== "";
    },
    validEmail() {
      const e = this.formData.email;
      if (!e || typeof e !== "string") return false;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
    },
    validPassword() {
      return typeof this.formData.password === "string" && this.formData.password.length >= 8;
    },
    adminFormValid() {
      return this.validUserName && this.validEmail && this.validPassword;
    },
    currentStepType() {
      return this.displaySteps[this.currentStep]?.type;
    },
    settingsStepValid() {
      if (this.settingsFromFile && Object.keys(this.settingsFromFile).length > 0) {
        const required = (this.wizardSettings || []).filter((s) => s.requiredInWizard);
        const missing = required.filter((s) => {
          const v = this.settingsFromFile[s.key];
          return v == null || String(v).trim() === "";
        });
        return missing.length === 0;
      }
      const stepType = this.currentStepType;
      const stepSettings = (this.wizardSettings || []).filter((s) => s.wizardStep === stepType);
      const required = stepSettings.filter((s) => s.requiredInWizard);
      return required.every(
        (s) => this.formSettings[s.key] != null && String(this.formSettings[s.key]).trim() !== ""
      );
    },
  },
  beforeMount() {
    this.validity = Object.fromEntries(Object.keys(this.formData).map(key => [key, false]));
  },
  async mounted() {
    const check = await axios.get(getServerURL() + "/auth/check", { withCredentials: true });
    this.hasAdmin = !!(check.data && check.data.user);

    if (check.data.user) {
      if (check.data.wizardCompleted) {
        await this.$router.push("/dashboard");
        return;
      }
      this.hasAdmin = true;
    }
    if (!check.data.user && check.data.needsSetup !== true) {
      await this.$router.push("/login");
      return;
    }

    const config = await axios.get(getServerURL() + "/setup/config", { withCredentials: true });
    if (config.data && config.data.steps) {
      this.steps = config.data.steps;
    }
    if (config.data && config.data.wizardSettings) {
      this.wizardSettings = config.data.wizardSettings;
      this.formSettings = config.data.wizardSettings.reduce((acc, s) => {
        acc[s.key] = this.wizardValueToFormString(s.value);
        return acc;
      }, {});

      // Keep sendmail and smtp mutually exclusive; sendmail takes precedence.
      if (this.formSettings["system.mailService.sendMail.enabled"] === "true") {
        this.formSettings["system.mailService.smtp.enabled"] = "false";
      }
    }
    if (config.data && Array.isArray(config.data.allSettings)) {
      this.allSettingsFromDb = config.data.allSettings;
    }
  },
  methods: {
    wizardValueToFormString(v) {
      if (v === null || v === undefined) return "";
      if (typeof v === "boolean") return v ? "true" : "false";
      if (typeof v === "object") return JSON.stringify(v);
      return String(v);
    },
    /**
     * Handle mail step setting changes.
     * @param {string} key - Setting key
     * @param {string} value - New value ('true' or 'false')
     */
    onMailSettingChange(key, value) {
      this.formSettings[key] = value;

      const sendmailKey = "system.mailService.sendMail.enabled";
      const smtpKey = "system.mailService.smtp.enabled";
      if (key === sendmailKey && value === "true") {
        this.formSettings[smtpKey] = "false";
      }
      if (key === smtpKey && value === "true") {
        this.formSettings[sendmailKey] = "false";
      }
    },
    /**
     * Group wizard settings by displaySubsection for a given step.
     * @param {string} stepType - general, mail, registration, moodle
     * @returns {Array<{title: string, settings: object[]}>}
     */
    fieldGroupsForStep(stepType) {
      const settings = (this.wizardSettings || []).filter((s) => s.wizardStep === stepType);
      if (!settings.length) return [];
      const order = this.subsectionOrder[stepType];
      const bySubsection = {};
      for (const s of settings) {
        const sub = s.displaySubsection || "";
        if (!bySubsection[sub]) bySubsection[sub] = [];
        bySubsection[sub].push(s);
      }
      const result = [];
      if (order) {
        for (const title of order) {
          if (bySubsection[title]?.length) {
            result.push({ title, settings: bySubsection[title] });
          }
        }
      }
      for (const [title, settingsList] of Object.entries(bySubsection)) {
        if (!order || !order.includes(title)) {
          result.push({ title: title || "", settings: settingsList });
        }
      }
      return result.length ? result : [{ title: "", settings }];
    },
    settingsForStep(stepType) {
      return (this.wizardSettings || []).filter((s) => s.wizardStep === stepType);
    },
    settingLabel(key) {
      const s = (this.wizardSettings || []).find((x) => x.key === key);
      return s?.displayName || key;
    },
    settingDescription(key) {
      const s = (this.wizardSettings || []).find((x) => x.key === key);
      return s?.description || null;
    },
    checkVal(key) {
      this.validity[key] = true;
    },
    submitAdmin() {
      Object.keys(this.validity).forEach(k => { this.validity[k] = true; });
      if (!this.adminFormValid) return;
      this.showError = false;
      this.errorMessage = "";
      this.currentStep++;
    },
    async doSubmitAdmin() {
      this.showError = false;
      try {
        const res = await axios.post(
          getServerURL() + "/auth/setup-admin",
          {
            userName: this.formData.userName.trim(),
            email: this.formData.email.trim(),
            password: this.formData.password,
          },
          {
            withCredentials: true,
            validateStatus: function (status) {
              return status === 200 || (status >= 400 && status < 500);
            },
          }
        );
        if (res.status === 200) {
          this.hasAdmin = true;
          return true;
        } else {
          this.showError = true;
          this.errorMessage = (res.data && res.data.message) || "Setup failed. Please try again.";
          return false;
        }
      } catch (err) {
        this.showError = true;
        this.errorMessage = err.message || "Setup failed. Please try again.";
        return false;
      }
    },
    onPrevious() {
      if (this.displaySteps[this.currentStep]?.type === "summary") {
        this.clearImport();
      }
      this.currentStep--;
    },
    onStepNext() {
      this.settingsTouched = true;
      if (!this.settingsStepValid) {
        if (this.settingsFromFile && Object.keys(this.settingsFromFile).length > 0 && this.currentStepType === "general") {
          this.showError = true;
          const required = (this.wizardSettings || []).filter((s) => s.requiredInWizard);
          const missing = required.filter((s) => {
            const v = this.settingsFromFile[s.key];
            return v == null || String(v).trim() === "";
          });
          this.errorMessage =
            missing.length > 0
              ? "The file must include non-empty values for: " + missing.map((s) => s.key).join(", ")
              : "Please upload a JSON file with key-value pairs.";
        } else {
          this.showError = false;
        }
        return;
      }
      this.showError = false;
      this.currentStep++;
    },
    openImportModal() {
      this.importFile = null;
      this.importError = null;
      if (this.$refs.jsonFileInput) this.$refs.jsonFileInput.value = "";
      this.$refs.importModal.open();
    },
    downloadImportTemplate() {
      const serialize = (v) => {
        if (v === null || v === undefined) return "";
        if (typeof v === "boolean") return v ? "true" : "false";
        if (typeof v === "object") return JSON.stringify(v);
        return String(v);
      };
      const flat = {};
      for (const row of this.allSettingsFromDb || []) {
        if (!row || !row.key) continue;
        flat[row.key] = serialize(row.value);
      }
      for (const [k, v] of Object.entries(this.formSettings || {})) {
        flat[k] = serialize(v);
      }
      downloadObjectsAs(flat, "care-settings-template", "json");
    },
    mailSettingsPayloadFromForm() {
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
    onJsonFileChange(ev) {
      this.importFile = ev.target.files && ev.target.files[0] || null;
      this.importError = null;
    },
    confirmImport() {
      if (!this.importFile) return;
      this.importing = true;
      this.importError = null;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const json = JSON.parse(reader.result);
          if (typeof json !== "object" || json === null || Array.isArray(json)) {
            throw new Error("The JSON must be an object of key/value pairs.");
          }
          const normalized = this.normalizeFileSettings(json);
          const { accepted, ignored } = this.filterKnownSettings(normalized);
          if (Object.keys(accepted).length === 0) {
            throw new Error(ignored.length
              ? `None of the keys in the file match known settings.`
              : "The file contains no settings.");
          }
          this.settingsFromFile = accepted;
          const importedCount = Object.keys(accepted).length;
          this.importFile = null;
          if (this.$refs.jsonFileInput) this.$refs.jsonFileInput.value = "";
          const nextSteps = this.displaySteps || [];
          const summaryIndex = nextSteps.findIndex((s) => s?.type === "summary");
          this.currentStep = summaryIndex >= 0 ? summaryIndex : Math.max(nextSteps.length - 1, 0);
          this.$refs.importModal.close();
          this.showError = false;
          const ignoredCount = ignored.length;
          this.eventBus.emit("toast", {
            title: "Settings imported",
            message: ignoredCount
              ? `Loaded ${importedCount} setting${importedCount === 1 ? "" : "s"}; ignored ${ignoredCount} unknown key${ignoredCount === 1 ? "" : "s"}.`
              : `Loaded ${importedCount} setting${importedCount === 1 ? "" : "s"} from file.`,
            variant: ignoredCount ? "warning" : "success",
          });
        } catch (e) {
          const msg = e?.message || String(e);
          this.importError = msg.startsWith("The JSON") ? msg : "Invalid JSON: " + msg;
          this.eventBus.emit("toast", {
            title: "Import failed",
            message: this.importError,
            variant: "danger",
          });
        } finally {
          this.importing = false;
        }
      };
      reader.readAsText(this.importFile);
    },
    clearImport() {
      this.settingsFromFile = null;
      if (this.$refs.jsonFileInput) this.$refs.jsonFileInput.value = "";
    },
    /**
     * Partition imported settings into known and unknown keys against /setup/config.
     * Accepts all keys while validSettingKeys is still loading.
     * @param {Record<string, string>} obj - Normalized imported settings
     * @returns {{accepted: Record<string, string>, ignored: string[]}}
     */
    filterKnownSettings(obj) {
      const valid = this.validSettingKeys;
      const accepted = {};
      const ignored = [];
      for (const [k, v] of Object.entries(obj)) {
        if (!valid || valid.has(k)) {
          accepted[k] = v;
        } else {
          ignored.push(k);
        }
      }
      return { accepted, ignored };
    },
    normalizeFileSettings(obj) {
      const out = {};
      for (const [k, v] of Object.entries(obj)) {
        if (v === null || v === undefined) {
          out[k] = "";
        } else if (typeof v === "boolean") {
          out[k] = v ? "true" : "false";
        } else if (typeof v === "object") {
          out[k] = JSON.stringify(v);
        } else {
          out[k] = String(v);
        }
      }
      return out;
    },
    summarySettingValue(key) {
      if (this.settingsFromFile && Object.prototype.hasOwnProperty.call(this.settingsFromFile, key)) {
        return this.settingsFromFile[key];
      }
      return this.formSettings[key] != null ? this.formSettings[key] : "—";
    },
    async finish() {
      this.settingsTouched = true;
      this.showError = false;
      this.errorMessage = "";

      if (!this.hasAdmin) {
        const created = await this.doSubmitAdmin();
        if (!created) return;
      }

      const merged = { ...this.formSettings, ...(this.settingsFromFile || {}) };
      if (merged["system.mailService.enabled"] !== "true") {
        merged["app.register.emailVerification"] = "false";
      }
      const payload = Object.entries(merged).map(([key, v]) => ({
        key,
        value: v === null || v === undefined ? "" : (typeof v === "boolean" ? (v ? "true" : "false") : (typeof v === "object" ? JSON.stringify(v) : String(v))),
      }));
      this.finishing = true;
      this.showError = false;
      try {
        const res = await axios.post(
          getServerURL() + "/setup/complete",
          { settings: payload },
          {
            withCredentials: true,
            validateStatus: (status) => status === 200 || (status >= 400 && status < 500),
          }
        );
        if (res.status !== 200 || !res.data?.success) {
          this.finishing = false;
          this.showError = true;
          this.errorMessage = res.data?.message || "Failed to save settings.";
          return;
        }
        this.$router.push("/dashboard");
        this.$router.go(0);
      } catch (err) {
        this.finishing = false;
        this.showError = true;
        this.errorMessage = err?.response?.data?.message || err?.message || "Failed to complete setup.";
      }
    },
  },
};
</script>

<style scoped>
.setup-wizard {
  min-height: 100vh;
  max-height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
}

.stepper {
  display: flex;
  justify-content: space-between;
  position: relative;
}

.stepper::after {
  content: "";
  position: absolute;
  top: 15px;
  left: 0;
  right: 0;
  height: 2px;
  background-color: #ccc;
}

.stepper > div {
  z-index: 1;
  background-color: white;
  padding: 0 5px;
}

.stepper > div::before {
  --dim: 28px;
  content: attr(data-index);
  margin-right: 6px;
  display: inline-flex;
  width: var(--dim);
  height: var(--dim);
  border-radius: 50%;
  align-items: center;
  justify-content: center;
  border: 1px solid #6c6b6b;
}

.stepper > div.active::before {
  color: white;
  background-color: #0d6efd;
  border-color: #0d6efd;
}

.feedback-invalid {
  font-size: 0.75em;
  color: firebrick;
  visibility: hidden;
  padding-top: 4px;
}

.feedback-invalid.invalid {
  visibility: visible;
}

.step-group-heading {
  font-size: 1.1rem;
  font-weight: 600;
}

.step-card-header {
  font-size: 1.2rem;
  font-weight: 600;
}
</style>
