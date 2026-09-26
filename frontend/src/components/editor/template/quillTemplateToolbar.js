/**
 * Manages the custom Quill toolbar controls used by TemplateEditor.vue.
 *
 * Injects language and view-mode selectors into Quill's toolbar,
 * handles their interactions and cleanup, and synchronizes toolbar
 * format visibility.
 *
 * Exports data, computed properties, and methods for spread
 * composition into TemplateEditor.vue. The toolbar is managed
 * directly because Quill renders it outside Vue's template tree.
 *
 * @author Mohammad Elwan
 */

import { SUPPORTED_LANGUAGES } from "@/components/editor/template/templateLanguageSwitching.js";

const VIEW_MODE_LABEL_KEYS = {
  edit: "templates.editor.viewMode.edit",
  preview: "templates.editor.viewMode.preview",
};

// Fresh data factory so toolbar DOM references are never shared across component instances
export function quillTemplateToolbarData() {
  return {
    languageSelectorEl: null,
    languageSelectorClickOutside: null,
  };
}

export const quillTemplateToolbarComputed = {
  toolbarVisible() {
    return this.$store.getters["settings/getValue"]("editor.toolbar.visibility") === "true" && !this.readOnly;
  },
};

export const quillTemplateToolbarMethods = {
  injectLanguageSelector(editorId) {
    // Quill inserts the toolbar as a sibling before the container, not inside it.
    const containerEl = document.getElementById(editorId);
    const toolbar = containerEl?.parentElement?.querySelector('.ql-toolbar') || document.querySelector(`#${editorId} .ql-toolbar`);
    if (!toolbar) {
      return;
    }

    // Create container span
    const formats = document.createElement("span");
    formats.className = "ql-formats";

    // Create picker wrapper
    const wrapper = document.createElement("span");
    wrapper.className = "ql-languageSelector ql-picker";

    const currentLanguage = SUPPORTED_LANGUAGES.find(l => l.code === this.selectedLanguage);
    const currentLabel = currentLanguage ? this.$t(currentLanguage.labelKey) : this.selectedLanguage;
    wrapper.innerHTML = `
      <span class="ql-picker-label" title="${this.$t("templates.editor.language")}">${currentLabel}
        <svg viewBox="0 0 18 18"><polygon class="ql-stroke" points="7 11 9 13 11 11 7 11"></polygon><polygon class="ql-stroke" points="7 7 9 5 11 7 7 7"></polygon></svg>
      </span>
      <span class="ql-picker-options">
        ${this.languageOptions.map(code => {
          const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
          return `<span class="ql-picker-item" data-value="${code}">${lang ? this.$t(lang.labelKey) : code}</span>`;
        }).join("")}
      </span>
    `;

    // Toggle dropdown on label click
    wrapper.addEventListener("click", (e) => {
      const labelEl = wrapper.querySelector(".ql-picker-label");
      if (labelEl && e.target !== labelEl && !labelEl.contains(e.target)) {
        return;
      }
      wrapper.classList.toggle("ql-expanded");
    });

    // Handle option selection
    wrapper.querySelectorAll(".ql-picker-item").forEach(item => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const value = item.dataset.value;
        wrapper.classList.remove("ql-expanded");
        // Update label
        const labelEl = wrapper.querySelector(".ql-picker-label");
        if (labelEl) {
          const lang = SUPPORTED_LANGUAGES.find(l => l.code === value);
          const svg = labelEl.querySelector("svg");
          labelEl.innerHTML = (lang ? this.$t(lang.labelKey) : value) + (svg ? svg.outerHTML : "");
        }
        this.selectLanguage(value);
      });
    });

    // Close dropdown on outside click
    this.languageSelectorClickOutside = (e) => {
      if (!wrapper.contains(e.target)) {
        wrapper.classList.remove("ql-expanded");
      }
    };
    document.addEventListener("click", this.languageSelectorClickOutside);

    formats.appendChild(wrapper);
    toolbar.appendChild(formats);
    this.languageSelectorEl = formats;
  },

  /**
   * Inject Edit / Preview picker next to the language selector on the Quill toolbar.
   *
   * @param {string} editorId
   */
  injectEditPreviewToggle(editorId) {
    if (!this.templateSupportsPlaceholderPreview) {
      return;
    }
    const containerEl = document.getElementById(editorId);
    const toolbar = containerEl?.parentElement?.querySelector(".ql-toolbar") || document.querySelector(`#${editorId} .ql-toolbar`);
    if (!toolbar) {
      return;
    }

    let formats = this.languageSelectorEl;
    if (!formats) {
      formats = document.createElement("span");
      formats.className = "ql-formats";
      toolbar.appendChild(formats);
      this.languageSelectorEl = formats;
    }

    formats.setAttribute("data-template-preview-toggle", "true");

    if (formats.querySelector(".ql-templateViewMode")) {
      return;
    }

    const wrapper = document.createElement("span");
    wrapper.className = "ql-templateViewMode ql-picker";

    const currentMode = this.previewMode ? "preview" : "edit";
    const currentLabel = this.$t(VIEW_MODE_LABEL_KEYS[currentMode]);
    wrapper.innerHTML = `
      <span class="ql-picker-label" title="${this.$t("templates.editor.viewMode.title")}">${currentLabel}
        <svg viewBox="0 0 18 18"><polygon class="ql-stroke" points="7 11 9 13 11 11 7 11"></polygon><polygon class="ql-stroke" points="7 7 9 5 11 7 7 7"></polygon></svg>
      </span>
      <span class="ql-picker-options">
        <span class="ql-picker-item" data-value="edit">${this.$t(VIEW_MODE_LABEL_KEYS.edit)}</span>
        <span class="ql-picker-item" data-value="preview">${this.$t(VIEW_MODE_LABEL_KEYS.preview)}</span>
      </span>
    `;

    wrapper.addEventListener("click", (e) => {
      const labelEl = wrapper.querySelector(".ql-picker-label");
      if (labelEl && e.target !== labelEl && !labelEl.contains(e.target)) {
        return;
      }
      wrapper.classList.toggle("ql-expanded");
    });

    wrapper.querySelectorAll(".ql-picker-item").forEach(item => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const value = item.dataset.value;
        wrapper.classList.remove("ql-expanded");
        const labelEl = wrapper.querySelector(".ql-picker-label");
        if (labelEl) {
          const svg = labelEl.querySelector("svg");
          labelEl.innerHTML = this.$t(VIEW_MODE_LABEL_KEYS[value]) + (svg ? svg.outerHTML : "");
        }
        this.setPreviewMode(value === "preview");
      });
    });

    if (this.editPreviewClickOutside) {
      document.removeEventListener("click", this.editPreviewClickOutside);
    }
    this.editPreviewClickOutside = (e) => {
      if (!wrapper.contains(e.target)) {
        wrapper.classList.remove("ql-expanded");
      }
    };
    document.addEventListener("click", this.editPreviewClickOutside);

    formats.appendChild(wrapper);
    this.editPreviewPickerEl = wrapper;
    this.syncEditPreviewPickerLabel();
  },

  syncEditPreviewPickerLabel() {
    const wrapper = this.editPreviewPickerEl;
    if (!wrapper) {
      return;
    }
    const label = wrapper.querySelector(".ql-picker-label");
    if (label) {
      const mode = this.previewMode ? "preview" : "edit";
      const svg = label.querySelector("svg");
      label.innerHTML = this.$t(VIEW_MODE_LABEL_KEYS[mode]) + (svg ? svg.outerHTML : '<svg viewBox="0 0 18 18"><polygon class="ql-stroke" points="7 11 9 13 11 11 7 11"></polygon><polygon class="ql-stroke" points="7 7 9 5 11 7 7 7"></polygon></svg>');
    }
  },

  /**
   * In read-only or example preview, hide formatting controls; keep language + view mode pickers.
   */
  syncToolbarFormatVisibility() {
    if (!this.editor) {
      return;
    }
    const toolbar = this.editor.getEditor().getModule("toolbar");
    if (!toolbar?.container) {
      return;
    }
    const compactToolbar = this.readOnly || this.previewMode;
    toolbar.container.style.display = "block";
    toolbar.container.querySelectorAll(".ql-formats").forEach((el) => {
      const keepVisible =
        el.querySelector(".ql-languageSelector") ||
        el.querySelector("[data-template-preview-toggle]") ||
        el.getAttribute("data-template-preview-toggle") === "true";
      el.style.display = compactToolbar && !keepVisible ? "none" : "";
    });
  },

  updateLanguageSelectorLabel() {
    const label = this.languageSelectorEl?.querySelector('.ql-picker-label');
    if (label) {
      const lang = SUPPORTED_LANGUAGES.find(l => l.code === this.selectedLanguage);
      const labelText = lang ? this.$t(lang.labelKey) : this.selectedLanguage;
      const svg = label.querySelector("svg");
      label.innerHTML = labelText + (svg ? svg.outerHTML : "");
    }
  },

  rebuildLanguageSelectorOptions() {
    const wrapper = this.languageSelectorEl?.querySelector('.ql-languageSelector');
    if (!wrapper) return;
    const optionsEl = wrapper.querySelector('.ql-picker-options');
    if (!optionsEl) return;
    optionsEl.innerHTML = this.languageOptions.map(code => {
      const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
      return `<span class="ql-picker-item" data-value="${code}">${lang ? this.$t(lang.labelKey) : code}</span>`;
    }).join("");
    wrapper.querySelectorAll(".ql-picker-item").forEach(item => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const value = item.dataset.value;
        wrapper.classList.remove("ql-expanded");
        const labelEl = wrapper.querySelector(".ql-picker-label");
        if (labelEl) {
          const lang = SUPPORTED_LANGUAGES.find(l => l.code === value);
          const svg = labelEl.querySelector("svg");
          labelEl.innerHTML = (lang ? this.$t(lang.labelKey) : value) + (svg ? svg.outerHTML : "");
        }
        this.selectLanguage(value);
      });
    });
  },

  /**
   * Remove toolbar-injected DOM (language selector, edit/preview toggle) and their
   * click-outside listeners. Called from TemplateEditor.vue's unmounted() hook.
   */
  teardownQuillTemplateToolbar() {
    if (this.editPreviewClickOutside) {
      document.removeEventListener("click", this.editPreviewClickOutside);
      this.editPreviewClickOutside = null;
    }

    if (this.languageSelectorClickOutside) {
      document.removeEventListener("click", this.languageSelectorClickOutside);
    }
    if (this.languageSelectorEl && this.languageSelectorEl.parentNode) {
      this.languageSelectorEl.parentNode.removeChild(this.languageSelectorEl);
      this.languageSelectorEl = null;
      this.editPreviewPickerEl = null;
    }
  },
};
