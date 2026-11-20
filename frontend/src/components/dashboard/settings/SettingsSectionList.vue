<template>
  <div class="mt-3">
    <SettingsSection
        v-for="section in sectionLayout"
        :key="section.title"
        :title="section.title"
        :subsections="section.subsections"
        :settings="settings"
    >
      <template v-if="section.title === 'Mail'" #footer>
        <slot name="mail-footer" />
      </template>
    </SettingsSection>
  </div>
</template>

<script>
import SettingsSection from "@/components/dashboard/settings/SettingsSection.vue";

/**
 * Order of subsections within each section (for display).
 */
const SUBSECTION_ORDER = {
  general: [
    "Copyright and consent",
    "Login options",
    "Study mode",
    "Landing page links",
    "ORCID login",
    "LDAP login",
    "SAML login",
    "Two-factor authentication",
    "API tokens",
    "Auth redirects",
  ],
  mail: ["Mail service", "Sendmail", "SMTP", "Base URL and verification", "Email templates"],
  registration: ["Enable registration", "Information requested at registration", "Consent options", "Terms and conditions", "Email verification rate limit"],
  moodle: ["Connection", "Course", "Show inputs"],
  annotations: ["Comments", "Download", "NLP in annotations", "Sidebar"],
  interface: ["Localization", "Navigation and dashboard", "Branding", "Projects", "Statistics and tags"],
  "text editor": ["Document buttons", "Edit history", "Toolbar"],
  "ai & nlp": ["Modal NLP", "NLP service"],
  system: ["Token expiry"],
};

/**
 * All settings sections of the settings dashboard. Setup-wizard settings come
 * first, in wizard order (General, Mail, Registration, Moodle); every other
 * display group follows alphabetically. Within a section, settings are grouped
 * into subsections (SUBSECTION_ORDER first, then any others).
 *
 * Slot `mail-footer` is rendered at the bottom of the Mail section.
 *
 * @author: Dennis Zyska
 */
export default {
  name: "SettingsSectionList",
  components: { SettingsSection },
  props: {
    /** Settings to show (setting rows are edited in place by SettingItem). */
    settings: {
      type: Array,
      required: true,
    },
  },
  computed: {
    sectionLayout() {
      if (!this.settings.length) return [];
      const wizardSteps = ["general", "mail", "registration", "moodle"];
      const sections = [];
      for (const step of wizardSteps) {
        let keys = this.settings
          .filter((s) => s.wizardStep === step && s.showInWizard)
          .sort((a, b) => (a.wizardOrder || 0) - (b.wizardOrder || 0))
          .map((s) => s.key);
        const otherInStep = this.settings.filter(
          (s) => !s.showInWizard && (s.displayGroup || "").toLowerCase() === step
        );
        if (otherInStep.length) {
          keys = [...keys, ...otherInStep.map((s) => s.key)];
        }

        // Terms of Service should be visible in both "General" and "Registration".
        if (step === "registration" && this.settings.some((s) => s.key === "app.register.terms")) {
          if (!keys.includes("app.register.terms")) keys.push("app.register.terms");
        }

        if (keys.length) {
          const settingsInSection = keys.map((k) => this.settings.find((s) => s.key === k)).filter(Boolean);
          sections.push({
            title: step.charAt(0).toUpperCase() + step.slice(1),
            subsections: this.buildSubsections(step, settingsInSection),
          });
        }
      }
      const other = this.settings.filter((s) => !s.showInWizard);
      const mergedSteps = new Set(wizardSteps);
      const otherGroups = {};
      for (const s of other) {
        const group = s.displayGroup || "Other";
        if (mergedSteps.has((group || "").toLowerCase())) continue;
        if (!otherGroups[group]) otherGroups[group] = [];
        otherGroups[group].push(s);
      }
      for (const [groupTitle, settingsInGroup] of Object.entries(otherGroups).sort((a, b) => a[0].localeCompare(b[0]))) {
        sections.push({
          title: groupTitle,
          subsections: this.buildSubsections(groupTitle.toLowerCase(), settingsInGroup),
        });
      }
      return sections;
    },
  },
  methods: {
    /**
     * Build subsections from settings grouped by displaySubsection.
     * @param {string} sectionKey - Section key (e.g. "general", "annotations")
     * @param {Array} settingsInSection - Setting objects in this section
     * @returns {Array<{title: string, keys: string[]}>}
     */
    buildSubsections(sectionKey, settingsInSection) {
      if (!settingsInSection.length) return [];
      const order = SUBSECTION_ORDER[sectionKey];
      const bySubsection = {};
      for (const s of settingsInSection) {
        const sub = s.displaySubsection || "";
        if (!bySubsection[sub]) bySubsection[sub] = [];
        bySubsection[sub].push(s.key);
      }
      const result = [];
      if (order) {
        for (const title of order) {
          if (bySubsection[title]?.length) {
            result.push({ title, keys: bySubsection[title] });
          }
        }
      }
      for (const [title, keys] of Object.entries(bySubsection)) {
        if (!order || !order.includes(title)) {
          result.push({ title: title || "", keys });
        }
      }
      return result.length ? result : [{ title: "", keys: settingsInSection.map((s) => s.key) }];
    },
  },
};
</script>
