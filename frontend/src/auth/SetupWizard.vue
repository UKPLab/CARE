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
        <div class="card-header step-card-header">Setup – Create admin account</div>
        <div class="card-body mx-4 my-4">
          <template v-if="adminCreatedThisSession">
            <p class="text-muted mb-3">
              The administrator account has been created. Continue to configure settings.
            </p>
            <button class="btn btn-primary" type="button" @click="currentStep++">
              Continue
            </button>
          </template>
          <template v-else>
            <p class="text-muted mb-3">
              No administrator account exists. Create one to finish setting up CARE.
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
              <button class="btn btn-primary" type="submit">Create admin and continue</button>
            </div>
          </form>
          </template>
        </div>
      </div>

      <!-- Step: General -->
      <div v-show="displaySteps[currentStep]?.type === 'general'" class="card">
        <div class="card-header step-card-header d-flex justify-content-between align-items-center">
          General Settings
          <button
            class="btn btn-outline-secondary btn-sm"
            type="button"
            title="Import settings from a JSON file (overrides form values)"
            @click="openImportModal"
          >
            Import JSON
          </button>
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
              Configure copyright notice, consent requirements, guest access, study mode, and links shown on the landing page.
            </p>

            <FormCollapsible
              v-for="group in generalFieldGroups"
              :key="group.title"
              :title="group.title"
              :collapsed="true"
              class="mb-3"
            >
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
                <div class="col-md-6 d-flex align-items-start">
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
                      rows="2"
                    />
                  </template>
                  <input
                    v-else
                    :id="'set-' + s.key"
                    v-model="formSettings[s.key]"
                    class="form-control"
                    type="text"
                  />
                  <FormHelp v-if="s.description" :help="s.description" class="ms-1" />
                </div>
                <div v-if="s.requiredInWizard" class="col-md-6 offset-md-4">
                  <div class="feedback-invalid" :class="{invalid: settingsTouched && !(formSettings[s.key] != null && String(formSettings[s.key]).trim() !== '')}">
                    This field is required.
                  </div>
                </div>
              </div>
            </FormCollapsible>
          </template>

          <div class="d-flex justify-content-between mt-4">
            <button v-if="currentStep > 0" class="btn btn-secondary" type="button" @click="onPrevious">Previous</button>
            <button
              class="btn btn-primary"
              :class="{ 'ms-auto': currentStep === 0 }"
              type="button"
              @click="onStepNext"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <!-- Step: Mail -->
      <div v-show="displaySteps[currentStep]?.type === 'mail'" class="card">
        <div class="card-header step-card-header">Mail Configuration</div>
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

          <template v-if="formSettings['system.mailService.enabled'] === 'true'">
            <FormCollapsible
              title="Email delivery configuration"
              description="Choose Sendmail or SMTP. If both are enabled, Sendmail takes precedence."
              :collapsed="true"
              class="mb-3"
            >
              <div class="form-check form-switch mb-3">
                <input
                  id="sendmail-enabled"
                  :checked="formSettings['system.mailService.sendMail.enabled'] === 'true'"
                  class="form-check-input"
                  type="checkbox"
                  @change="formSettings['system.mailService.sendMail.enabled'] = $event.target.checked ? 'true' : 'false'"
                />
                <label class="form-check-label" for="sendmail-enabled" @click.prevent>
                  Use Sendmail (Unix system mail command)
                </label>
                <FormHelp
                  :help="'If enabled, Sendmail is used for outgoing mail even when SMTP is also enabled.'"
                  class="ms-1"
                />
              </div>
              <FormCollapsible
                v-if="formSettings['system.mailService.sendMail.enabled'] === 'true'"
                title="Sendmail settings"
                description="Path to the sendmail binary on your system"
                :collapsed="false"
              >
                <div
                  v-for="s in sendmailSettings"
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
                  <div class="col-md-6 d-flex align-items-start">
                    <input
                      :id="'set-' + s.key"
                      v-model="formSettings[s.key]"
                      class="form-control"
                      type="text"
                    />
                    <FormHelp v-if="s.description" :help="s.description" class="ms-1" />
                  </div>
                </div>
              </FormCollapsible>

              <div class="form-check form-switch mb-3 mt-3">
                <input
                  id="smtp-enabled"
                  :checked="formSettings['system.mailService.smtp.enabled'] === 'true'"
                  class="form-check-input"
                  type="checkbox"
                  @change="formSettings['system.mailService.smtp.enabled'] = $event.target.checked ? 'true' : 'false'"
                />
                <label class="form-check-label" for="smtp-enabled" @click.prevent>
                  Use SMTP server
                </label>
                <FormHelp
                  :help="'Used only when Sendmail is disabled. Configure your SMTP host and credentials.'"
                  class="ms-1"
                />
              </div>
              <FormCollapsible
                v-if="formSettings['system.mailService.smtp.enabled'] === 'true'"
                title="SMTP settings"
                description="Host, port, and authentication for your SMTP server"
                :collapsed="false"
              >
                <div
                  v-for="s in smtpSettings"
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
                  <div class="col-md-6 d-flex align-items-start">
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
                      v-else
                      :id="'set-' + s.key"
                      v-model="formSettings[s.key]"
                      class="form-control"
                      type="text"
                    />
                    <FormHelp v-if="s.description" :help="s.description" class="ms-1" />
                  </div>
                </div>
              </FormCollapsible>

              <FormCollapsible
                title="Sender and application URL"
                description="Required for all outgoing emails: the From address and base URL for links"
                :collapsed="true"
                class="mt-3"
              >
                <div class="form-group row my-2">
                  <label class="col-md-4 col-form-label text-md-right" for="set-sender-address">
                    {{ settingLabel("system.mailService.senderAddress") }}
                  </label>
                  <div class="col-md-6 d-flex align-items-start">
                    <input
                      id="set-sender-address"
                      v-model="formSettings['system.mailService.senderAddress']"
                      class="form-control"
                      type="text"
                    />
                    <FormHelp
                      :help="'The From address used for all outgoing emails.'"
                      class="ms-1"
                    />
                  </div>
                </div>
                <div class="form-group row my-2">
                  <label class="col-md-4 col-form-label text-md-right" for="set-base-url">
                    {{ settingLabel("system.baseUrl") }}
                  </label>
                  <div class="col-md-6 d-flex align-items-start">
                    <input
                      id="set-base-url"
                      v-model="formSettings['system.baseUrl']"
                      class="form-control"
                      type="text"
                    />
                    <FormHelp
                      :help="'Base URL of this application (e.g. https://care.example.com). Required for password reset and email verification links.'"
                      class="ms-1"
                    />
                  </div>
                </div>
              </FormCollapsible>
            </FormCollapsible>
            <FormCollapsible
              title="Features that use email"
              description="Optional features that require the email service to be enabled"
              :collapsed="true"
              class="mb-3 mt-3"
            >
              <div class="form-check form-switch">
                <input
                  id="forgot-password"
                  :checked="formSettings['app.login.forgotPassword'] === 'true'"
                  class="form-check-input"
                  type="checkbox"
                  @change="formSettings['app.login.forgotPassword'] = $event.target.checked ? 'true' : 'false'"
                />
                <label class="form-check-label" for="forgot-password" @click.prevent>
                  Allow users to reset their password via email
                </label>
              </div>
            </FormCollapsible>
          </template>

          <div class="d-flex justify-content-between mt-4">
            <button class="btn btn-secondary" type="button" @click="onPrevious">Previous</button>
            <button class="btn btn-primary ms-auto" type="button" @click="onStepNext">
              Next
            </button>
          </div>
        </div>
      </div>

      <!-- Step: Registration -->
      <div v-show="displaySteps[currentStep]?.type === 'registration'" class="card">
        <div class="card-header step-card-header">User Registration</div>
        <div class="card-body mx-4 my-4">
          <p v-if="showError" class="text-danger text-center">{{ errorMessage }}</p>
          <p class="text-muted mb-3">
            Configure which information and consents are requested from users during registration.
          </p>

          <FormCollapsible
            v-for="group in registrationFieldGroups"
            :key="group.title"
            :title="group.title"
            :collapsed="true"
            class="mb-3"
          >
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
              <div class="col-md-6 d-flex align-items-start">
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
                    rows="2"
                  />
                </template>
                <input
                  v-else
                  :id="'set-' + s.key"
                  v-model="formSettings[s.key]"
                  class="form-control"
                  type="text"
                />
                <FormHelp
                  v-if="settingDescription(s.key) || s.description"
                  :help="settingDescription(s.key) || s.description"
                  class="ms-1"
                />
              </div>
            </div>
          </FormCollapsible>
          <FormCollapsible
            v-if="mailEnabled"
            title="Email verification"
            description="Require new users to verify their email before accessing the application"
            :collapsed="true"
            class="mb-3"
          >
            <div class="form-group row my-2">
              <label class="col-md-4 col-form-label text-md-right" for="email-verification-reg" @click.prevent>
                {{ settingLabel("app.register.emailVerification") }}
              </label>
              <div class="col-md-6 d-flex align-items-start">
                <div class="form-check form-switch">
                  <input
                    id="email-verification-reg"
                    :checked="formSettings['app.register.emailVerification'] === 'true'"
                    class="form-check-input"
                    type="checkbox"
                    @change="formSettings['app.register.emailVerification'] = $event.target.checked ? 'true' : 'false'"
                  />
                </div>
                <FormHelp
                  :help="'Require new users to verify their email address before accessing the application.'"
                  class="ms-1"
                />
              </div>
            </div>
          </FormCollapsible>

          <div class="d-flex justify-content-between mt-4">
            <button class="btn btn-secondary" type="button" @click="onPrevious">Previous</button>
            <button class="btn btn-primary ms-auto" type="button" @click="onStepNext">
              Next
            </button>
          </div>
        </div>
      </div>

      <!-- Step: Moodle -->
      <div v-show="displaySteps[currentStep]?.type === 'moodle'" class="card">
        <div class="card-header step-card-header d-flex align-items-center">
          Moodle Integration
          <span class="badge bg-secondary ms-2">Optional</span>
        </div>
        <div class="card-body mx-4 my-4">
          <p v-if="showError" class="text-danger text-center">{{ errorMessage }}</p>
          <div class="alert alert-info mb-3 py-2" role="alert">
            <strong>This step is optional.</strong> Configure it only if you use Moodle. You can skip it now and configure Moodle integration later in Settings.
          </div>

          <div v-for="group in moodleFieldGroups" :key="group.title" class="mb-4">
            <h6 class="step-group-heading text-muted border-bottom pb-1 mb-3">{{ group.title }}</h6>
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
              <div class="col-md-6 d-flex align-items-start">
                <input
                  :id="'set-' + s.key"
                  v-model="formSettings[s.key]"
                  class="form-control"
                  type="text"
                />
                <FormHelp v-if="s.description" :help="s.description" class="ms-1" />
              </div>
            </div>
          </div>

          <div class="d-flex justify-content-between mt-4">
            <button class="btn btn-secondary" type="button" @click="onPrevious">Previous</button>
            <button class="btn btn-primary ms-auto" type="button" @click="onStepNext">
              Next
            </button>
          </div>
        </div>
      </div>

      <!-- Step: Summary -->
      <div v-show="displaySteps[currentStep]?.type === 'summary'" class="card">
        <div class="card-header step-card-header">Summary</div>
        <div class="card-body mx-4 my-4">
          <p class="text-muted mb-3">Review your choices before finishing.</p>

          <FormCollapsible
            v-if="!hasAdmin"
            title="Admin"
            :collapsed="false"
            class="mb-3"
          >
            <ul class="list-unstyled mb-0">
              <li><strong>Username:</strong> {{ formData.userName || "—" }}</li>
              <li><strong>Email:</strong> {{ formData.email || "—" }}</li>
              <li><strong>Password:</strong> Password set</li>
            </ul>
          </FormCollapsible>

          <FormCollapsible
            v-for="group in summaryFieldGroups"
            :key="group.title"
            :title="group.title"
            :collapsed="false"
            class="mb-3"
          >
            <ul class="list-unstyled ms-2 mb-0">
              <li v-for="s in group.settings" :key="s.key">
                <strong>{{ settingLabel(s.key) }}:</strong> {{ summarySettingValue(s.key) }}
              </li>
            </ul>
          </FormCollapsible>

          <div v-if="settingsFromFile && Object.keys(settingsFromFile).length" class="mt-4">
            <button
              class="btn btn-link p-0 text-secondary"
              type="button"
              @click="showFileSettings = !showFileSettings"
            >
              {{ showFileSettings ? "▼" : "▶" }} Additional settings from file ({{ Object.keys(settingsFromFile).length }})
            </button>
            <ul v-show="showFileSettings" class="list-unstyled mt-2 ms-3 small">
              <li v-for="(v, k) in settingsFromFile" :key="k"><strong>{{ k }}:</strong> {{ v }}</li>
            </ul>
          </div>

          <div class="d-flex justify-content-between mt-4">
            <button v-if="currentStep > 0" class="btn btn-secondary" type="button" @click="onPrevious">Previous</button>
            <button
              class="btn btn-primary"
              :class="{ 'ms-auto': currentStep === 0 }"
              type="button"
              :disabled="finishing"
              @click="finish"
            >
              {{ finishing ? "Saving…" : "Finish" }}
            </button>
          </div>
        </div>
      </div>

      <!-- Import JSON Modal -->
      <Modal ref="importModal" name="wizardImportSettings">
        <template #title>Import Settings</template>
        <template #body>
          <p class="mb-2">
            Select a JSON file with settings. Loaded values will override the form and skip the following steps: Mail, Registration, and Moodle.
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
          <button
            class="btn btn-secondary me-2"
            type="button"
            :disabled="importing"
            @click="$refs.importModal.close()"
          >
            Close
          </button>
          <button
            class="btn btn-primary"
            type="button"
            :disabled="!importFile || importing"
            @click="confirmImport"
          >
            <span
              v-if="importing"
              class="spinner-border spinner-border-sm me-1"
              role="status"
              aria-hidden="true"
            />
            Import
          </button>
        </template>
      </Modal>
    </div>
  </div>
</template>

<script>
/**
 * First-time setup wizard: Admin, General (with optional JSON import), Mail, Registration, Moodle, Summary.
 * Fetches /setup/config for steps and wizardSettings. On Finish, calls settingSave and redirects.
 *
 * @author CARE
 */
import IconAsset from "@/basic/icon/IconAsset.vue";
import FormHelp from "@/basic/form/Help.vue";
import FormCollapsible from "@/basic/form/Collapsible.vue";
import Modal from "@/basic/Modal.vue";
import axios from "axios";
import getServerURL from "@/assets/serverUrl";

/** User-facing labels for setting keys hardcoded for now later will create db migration to change to more descriptive labels*/
const SETTING_LABELS = {
  "app.config.copyright": "Copyright notice",
  "app.config.consent.enabled": "Require consent before first use",
  "app.login.guest": "Allow guest login",
  "app.login.forgotPassword": "Enable forgot password",
  "app.study.enabled": "Enable study mode",
  "app.landing.showDocs": "Show documentation link",
  "app.landing.linkDocs": "Documentation URL",
  "app.landing.showProject": "Show project link",
  "app.landing.linkProject": "Project URL",
  "app.landing.showFeedback": "Show feedback link",
  "app.landing.linkFeedback": "Feedback URL",
  "system.mailService.enabled": "Enable email service",
  "system.mailService.senderAddress": "Sender address",
  "system.mailService.sendMail.enabled": "Use Sendmail",
  "system.mailService.sendMail.path": "Path to sendmail binary",
  "system.mailService.smtp.enabled": "Use SMTP",
  "system.mailService.smtp.host": "SMTP host",
  "system.mailService.smtp.port": "SMTP port",
  "system.mailService.smtp.secure": "Use secure connection (TLS)",
  "system.mailService.smtp.auth.enabled": "SMTP authentication",
  "system.mailService.smtp.auth.user": "SMTP username",
  "system.mailService.smtp.auth.pass": "SMTP password",
  "system.baseUrl": "Application base URL",
  "app.register.emailVerification": "Require email verification",
  "app.register.requestName": "Ask for display name at registration",
  "app.register.requestStats": "Ask for usage statistics consent at registration",
  "app.register.requestData": "Ask for annotation data sharing consent at registration",
  "app.register.acceptStats.default": "Pre-select statistics consent checkbox for new users",
  "app.register.acceptDataSharing.default": "Pre-select data sharing consent checkbox for new users",
  "app.register.terms": "Terms and conditions (URL or text)",
  "rpc.moodleAPI.apiUrl": "Moodle API URL",
  "rpc.moodleAPI.apiKey": "Moodle API key",
  "rpc.moodleAPI.courseID": "Moodle course ID",
};

/** Override descriptions for settings where the default is unclear, hardcoded for now later will create db migration to change to more descriptive descriptions */
const SETTING_DESCRIPTIONS = {
  "app.register.acceptStats.default":
    "When you ask new users for consent to collect anonymous usage statistics (e.g. how often features are used) to improve CARE, this sets whether that checkbox is pre-checked or unchecked by default.",
  "app.register.acceptDataSharing.default":
    "When you ask new users for consent to share their annotation data (their labels and annotations on documents) for research purposes, this sets whether that checkbox is pre-checked or unchecked by default.",
};

export default {
  name: "SetupWizard",
  components: { IconAsset, FormHelp, FormCollapsible, Modal },
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
      adminCreatedThisSession: false,
    };
  },
  computed: {
    isReRun() {
      return this.$route.query.reRun === "true";
    },
    displaySteps() {
      const stepTypes = ["admin", "general", "mail", "registration", "moodle", "summary"];
      let filtered = this.steps.filter((s) => stepTypes.includes(s.type));
      if (this.hasAdmin) {
        filtered = filtered.filter((s) => s.type !== "admin");
      }
      if (this.settingsFromFile && Object.keys(this.settingsFromFile).length > 0) {
        filtered = filtered.filter((s) => !["mail", "registration", "moodle"].includes(s.type));
      }
      return filtered;
    },
    generalFieldGroups() {
      const keyToSetting = (this.wizardSettings || []).reduce((acc, s) => {
        acc[s.key] = s;
        return acc;
      }, {});
      const groups = [
        {
          title: "Copyright and consent",
          keys: ["app.config.copyright", "app.config.consent.enabled"],
        },
        {
          title: "Login options",
          keys: ["app.login.guest", "app.login.forgotPassword"],
        },
        {
          title: "Study mode",
          keys: ["app.study.enabled"],
        },
        {
          title: "Landing page links",
          keys: [
            "app.landing.showDocs",
            "app.landing.linkDocs",
            "app.landing.showProject",
            "app.landing.linkProject",
            "app.landing.showFeedback",
            "app.landing.linkFeedback",
          ],
        },
      ];
      return groups.map((g) => ({
        title: g.title,
        settings: g.keys.map((k) => keyToSetting[k]).filter(Boolean),
      })).filter((g) => g.settings.length > 0);
    },
    registrationFieldGroups() {
      const keyToSetting = (this.wizardSettings || []).reduce((acc, s) => {
        acc[s.key] = s;
        return acc;
      }, {});
      const groups = [
        {
          title: "Information requested at registration",
          keys: ["app.register.requestName", "app.register.requestStats", "app.register.requestData"],
        },
        {
          title: "Consent options",
          keys: ["app.register.acceptStats.default", "app.register.acceptDataSharing.default"],
        },
        {
          title: "Terms and conditions",
          keys: ["app.register.terms"],
        },
      ];
      return groups.map((g) => ({
        title: g.title,
        settings: g.keys.map((k) => keyToSetting[k]).filter(Boolean),
      })).filter((g) => g.settings.length > 0);
    },
    mailEnabled() {
      return this.formSettings["system.mailService.enabled"] === "true";
    },
    sendmailSettings() {
      const keys = ["system.mailService.sendMail.path"];
      return (this.wizardSettings || []).filter((s) => keys.includes(s.key));
    },
    smtpSettings() {
      const keys = [
        "system.mailService.smtp.host",
        "system.mailService.smtp.port",
        "system.mailService.smtp.secure",
        "system.mailService.smtp.auth.enabled",
        "system.mailService.smtp.auth.user",
        "system.mailService.smtp.auth.pass",
      ];
      return (this.wizardSettings || []).filter((s) => keys.includes(s.key));
    },
    moodleFieldGroups() {
      const keyToSetting = (this.wizardSettings || []).reduce((acc, s) => {
        acc[s.key] = s;
        return acc;
      }, {});
      const groups = [
        {
          title: "Connection",
          keys: ["rpc.moodleAPI.apiUrl", "rpc.moodleAPI.apiKey"],
        },
        {
          title: "Course",
          keys: ["rpc.moodleAPI.courseID"],
        },
      ];
      return groups.map((g) => ({
        title: g.title,
        settings: g.keys.map((k) => keyToSetting[k]).filter(Boolean),
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

    if (check.data.user && !this.isReRun) {
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

    const url = (this.hasAdmin || this.isReRun) ? getServerURL() + "/setup/config?reRun=true" : getServerURL() + "/setup/config";
    const config = await axios.get(url, { withCredentials: true });
    if (config.data && config.data.steps) {
      this.steps = config.data.steps;
    }
    if (config.data && config.data.wizardSettings) {
      this.wizardSettings = config.data.wizardSettings;
      this.formSettings = config.data.wizardSettings.reduce((acc, s) => {
        acc[s.key] = s.value != null && s.value !== undefined ? String(s.value) : "";
        return acc;
      }, {});
    }
    if (this.hasAdmin && this.$socket && !this.$socket.connected) {
      this.$socket.connect();
    }
  },
  methods: {
    settingsForStep(stepType) {
      return (this.wizardSettings || []).filter((s) => s.wizardStep === stepType);
    },
    settingLabel(key) {
      return SETTING_LABELS[key] || key;
    },
    settingDescription(key) {
      return SETTING_DESCRIPTIONS[key] || null;
    },
    checkVal(key) {
      this.validity[key] = true;
    },
    submitAdmin() {
      Object.keys(this.validity).forEach(k => { this.validity[k] = true; });
      if (!this.adminFormValid) return;
      this.doSubmitAdmin();
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
          this.adminCreatedThisSession = true;
          if (this.$socket && !this.$socket.connected) {
            this.$socket.connect();
          }
          this.currentStep = 1;
        } else {
          this.showError = true;
          this.errorMessage = (res.data && res.data.message) || "Setup failed. Please try again.";
        }
      } catch (err) {
        this.showError = true;
        this.errorMessage = err.message || "Setup failed. Please try again.";
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
            this.importError = "The JSON must be an object of key/value pairs.";
            return;
          }
          this.settingsFromFile = this.normalizeFileSettings(json);
          this.importFile = null;
          if (this.$refs.jsonFileInput) this.$refs.jsonFileInput.value = "";
          this.$refs.importModal.close();
          this.showError = false;
        } catch (e) {
          this.importError = "Invalid JSON: " + (e.message || String(e));
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
      if (!this.$socket || !this.$socket.connected) {
        this.showError = true;
        this.errorMessage = "Connection not ready. Please wait and try again.";
        return;
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
      this.$socket.emit("settingSave", payload, async (res) => {
        if (!res.success) {
          this.finishing = false;
          this.showError = true;
          this.errorMessage = (res && res.message) || "Failed to save settings.";
          return;
        }
        try {
          await axios.patch(getServerURL() + "/setup/state", { wizardCompleted: "true" }, { withCredentials: true });
          this.$router.push("/dashboard");
          this.$router.go(0);
        } catch (err) {
          this.finishing = false;
          this.showError = true;
          this.errorMessage = err?.response?.data?.message || err?.message || "Failed to complete setup.";
        }
      });
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
