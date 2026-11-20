/**
 * Manages language switching for TemplateEditor.vue.
 *
 * Fetches available languages, loads language-specific content,
 * and handles switching between existing languages or adding
 * new ones with either empty or copied content.
 * Also handles template-loading errors.
 *
 * Exports data, computed properties, and methods for spread
 * composition into TemplateEditor.vue.
 *
 * @author Mohammad Elwan
 */

import { resolveApiMessage } from "@/assets/utils";

export const SUPPORTED_LANGUAGES = [
  { code: "en", labelKey: "common.languages.en" },
  { code: "de", labelKey: "common.languages.de" },
  { code: "fr", labelKey: "common.languages.fr" },
];

// Fresh data factory so language-switching state is never shared across component instances
export function templateLanguageSwitchingData() {
  return {
    selectedLanguage: "en",
    availableLanguages: [],
    pendingNewLanguage: null,
    newLanguageModalMessage: "",
  };
}

export const templateLanguageSwitchingComputed = {
  templateDefaultLanguage() {
    return (this.template && this.template.defaultLanguage) || "en";
  },
  languageOptions() {
    if (this.readOnly) {
      return this.availableLanguages.slice();
    }
    // Available languages first, then supported languages not yet added
    const existing = new Set(this.availableLanguages);
    const options = this.availableLanguages.slice();
    SUPPORTED_LANGUAGES.forEach(({ code }) => {
      if (!existing.has(code)) {
        options.push(code);
      }
    });
    return options;
  },
};

export const templateLanguageSwitchingMethods = {
  fetchLanguagesAndLoadContent() {
    this.$socket.emit("templateGetLanguages", { templateId: this.templateId }, (res) => {

      const data = res.success && res.data ? res.data : {};
      const languagesArray = Array.isArray(data) ? data : (data.languages || []);
      const defaultLanguageFromServer = (data && typeof data === "object" && !Array.isArray(data) && data.defaultLanguage) ? data.defaultLanguage : null;

      if (languagesArray.length > 0) {
        this.availableLanguages = languagesArray;
      }

      // Rebuild dropdown options
      this.rebuildLanguageSelectorOptions();

      // Prefer defaultLanguage from server (template row); fallback to store, then "en"
      const defaultLang = defaultLanguageFromServer || this.templateDefaultLanguage || "en";
      this.selectedLanguage = this.availableLanguages.includes(defaultLang)
        ? defaultLang
        : (this.availableLanguages[0] || defaultLang);

      // Update dropdown label
      this.$nextTick(() => this.updateLanguageSelectorLabel());

      this.loadContentForLanguage(this.selectedLanguage);
    });
  },

  loadContentForLanguage(language) {
    this.$socket.emit("templateGetContent",
      {
        templateId: this.templateId,
        language: language,
      },
      (res) => {
        if (res.success) {
          this.initializeEditorWithContent(res['data']['deltas']);

          // Track if this is a newly added language
          if (res['data']['isNewLanguage']) {
            this.availableLanguages = [...new Set([...this.availableLanguages, language])].sort();
          }

          // Set first version to current
          if (this.editor) {
            let currentVersion = this.editor.getEditor().root.innerHTML;
            this.firstVersion = currentVersion;

            let studyData = {
              firstVersion: this.firstVersion,
              currentVersion: currentVersion,
            };
            this.$emit("update:data", studyData);
          }
        } else {
          this.handleTemplateError(res.error || res || { message: this.$t("templates.editor.toasts.failedToLoadTemplate") });
        }
      }
    );
  },

  selectLanguage(value) {
    if (!value || value === this.selectedLanguage) {
      return;
    }
    if (this.readOnly) {
      this.selectedLanguage = value;
      this.loadContentForLanguage(value);
      this.$nextTick(() => this.updateLanguageSelectorLabel());
      return;
    }
    const isNew = !this.availableLanguages.includes(value);
    if (isNew) {
      this.pendingNewLanguage = value;
      this.newLanguageModalMessage = this.$t("templates.editor.newLanguageMessage");
      this.$refs.newLanguageModal.openModal();
    } else {
      this.saveCurrentAndSwitchTo(value);
    }
  },

  onNewLanguageModalHide() {
    if (this.pendingNewLanguage) {
      this.$nextTick(() => this.updateLanguageSelectorLabel());
      this.pendingNewLanguage = null;
    }
  },

  chooseNewLanguageEmpty() {
    const value = this.pendingNewLanguage;
    this.$refs.newLanguageModal.close();
    this.pendingNewLanguage = null;
    if (value) this.addLanguageAndSwitch(value, false);
  },

  chooseNewLanguageCopied() {
    const value = this.pendingNewLanguage;
    this.$refs.newLanguageModal.close();
    this.pendingNewLanguage = null;
    if (value) this.addLanguageAndSwitch(value, true);
  },

  addLanguageAndSwitch(newLang, copyContent) {
    // Save current language first; only add language if save succeeded
    this.$socket.emit("templateClose",
      { templateId: this.templateId, language: this.selectedLanguage },
      (closeRes) => {
        if (!closeRes.success) {
          this.eventBus.emit("toast", {
            title: this.$t("templates.editor.toasts.templateSaveFailed"),
            message: resolveApiMessage(closeRes),
            variant: "danger"
          });
          return;
        }
        const content = (copyContent && this.editor) ? this.editor.getEditor().getContents() : undefined;
        this.$socket.emit("templateAddLanguageContent",
          {
            templateId: this.templateId,
            language: newLang,
            content: (content && content.ops) ? { ops: content.ops } : undefined
          },
          (res) => {
            if (res.success) {
              this.availableLanguages = [...new Set([...this.availableLanguages, newLang])].sort();
              this.selectedLanguage = newLang;
              this.loadContentForLanguage(newLang);
              this.$nextTick(() => this.updateLanguageSelectorLabel());
            } else {
              this.eventBus.emit("toast", {
                title: this.$t("templates.editor.toasts.failedToAddLanguage"),
                message: resolveApiMessage(res),
                variant: "danger"
              });
            }
          }
        );
      }
    );
  },

  saveCurrentAndSwitchTo(newLang) {
    // Save current language, then switch only if save succeeded
    this.$socket.emit("templateClose",
      { templateId: this.templateId, language: this.selectedLanguage },
      (res) => {
        if (!res.success) {
          this.eventBus.emit("toast", {
            title: this.$t("templates.editor.toasts.templateSaveFailed"),
            message: resolveApiMessage(res),
            variant: "danger"
          });
          return;
        }
        this.selectedLanguage = newLang;
        this.loadContentForLanguage(newLang);
        this.$nextTick(() => this.updateLanguageSelectorLabel());
      }
    );
  },

  handleTemplateError(error) {
    this.eventBus.emit('toast', {
    title: this.$t("templates.editor.toasts.templateError"),
    message: resolveApiMessage(error),
    variant: "danger"
  });
  },
};
