<template>
  <FormElement
    ref="formElement"
    :data-table="dataTable"
    :options="options"
  >
    <template #element="{ blur }">
      <div
        v-if="options.search"
        ref="searchSelect"
        class="searchable-select w-100"
      >
        <input
          v-if="isOpen"
          ref="searchInput"
          v-model="searchQuery"
          type="text"
          class="form-select searchable-select-toggle"
          :class="selectClass"
          :disabled="isDisabled"
          :placeholder="options.placeholder || $t('common.search')"
          :aria-label="$t('common.searchOptions')"
          @keydown.escape.prevent="isOpen = false"
        >
        <button
          v-else
          type="button"
          class="form-select text-start searchable-select-toggle"
          :class="selectClass"
          :disabled="isDisabled"
          @click="isOpen = true"
        >
          <span
            class="searchable-select-label"
            :class="{ 'text-muted': !hasSelection }"
          >
            {{ selectedLabel }}
          </span>
        </button>
        <div
          v-if="isOpen"
          class="dropdown-menu show searchable-select-menu w-100"
        >
          <div class="searchable-select-options">
            <button
              v-for="option in filteredSelectOptions"
              :key="option.value"
              type="button"
              class="dropdown-item"
              :class="[option.class, { active: currentData === option.value }]"
              :disabled="option.disabled"
              @mousedown.prevent="selectOption(option, blur)"
            >
              {{ translateMaybeKey(option.name) }}
            </button>
            <div
              v-if="filteredSelectOptions.length === 0"
              class="dropdown-item text-muted disabled"
            >
              {{ $t('common.noMatches') }}
            </div>
          </div>
        </div>
      </div>
      <!-- Custom listbox instead of a native <select>: the browser popup (Firefox) cannot be
           styled and highlights only part of the row. -->
      <div
        v-else
        ref="listTrigger"
        class="care-select w-100"
        :class="{ 'is-open': listOpen }"
      >
        <button
          :id="options.key"
          ref="listButton"
          type="button"
          class="form-select care-select__toggle"
          :class="selectClass"
          :disabled="isDisabled"
          aria-haspopup="listbox"
          :aria-expanded="listOpen ? 'true' : 'false'"
          :aria-controls="listId"
          @click="toggleList"
          @keydown="onListButtonKeydown"
          @blur="onListBlur(blur)"
        >
          <span
            class="care-select__label"
            :class="{ 'text-muted': !hasListSelection }"
          >{{ listSelectedLabel }}</span>
        </button>

        <!-- Inside a modal the menu goes into the .modal element, otherwise Bootstrap's focus
             trap pulls focus back to the modal's close button -->
        <Teleport :to="teleportTarget">
          <Transition name="care-select-menu">
            <ul
              v-if="listOpen"
              :id="listId"
              ref="listMenu"
              class="care-menu care-select__menu"
              role="listbox"
              tabindex="-1"
              :aria-labelledby="options.key"
              :aria-activedescendant="activeIndex >= 0 ? optionDomId(activeIndex) : undefined"
              :style="menuStyle"
              @keydown="onListMenuKeydown"
              @focusout="onMenuFocusout(blur, $event)"
            >
              <li
                v-for="(item, index) in listItems"
                :id="optionDomId(index)"
                :key="String(item.value) + '_' + index"
                role="option"
                class="care-select__option"
                :class="[item.class, {
                  'is-selected': item.value === currentData,
                  'is-active': index === activeIndex,
                  'is-disabled': item.disabled,
                }]"
                :aria-selected="item.value === currentData ? 'true' : 'false'"
                :aria-disabled="item.disabled ? 'true' : undefined"
                @mousedown.prevent
                @click="pickListItem(item, blur)"
                @mousemove="activeIndex = index"
              >
                <span class="care-select__option-label">{{ item.label }}</span>
                <LoadIcon
                  v-if="item.value === currentData"
                  class="care-select__check"
                  icon-name="check2"
                  :size="15"
                />
              </li>
              <li
                v-if="listItems.length === 0"
                class="care-select__option is-disabled"
                aria-disabled="true"
              >
                {{ $t('common.noMatches') }}
              </li>
            </ul>
          </Transition>
        </Teleport>
      </div>
    </template>
  </FormElement>
</template>

<script>
import FormElement from "@/basic/form/Element.vue";
import LoadIcon from "@/basic/Icon.vue";
import { translateMaybeKey } from "@/assets/utils";
import {
  bindPopupListeners,
  createTypeahead,
  handleListboxKeydown,
  placePopup,
  popupTeleportTarget,
  uniqueId,
} from "@/basic/form/helpers/listbox";

export default {
  name: "FormSelect",
  components: { FormElement, LoadIcon },
  inject: {
    formData: {
      default: () => null,
    },
  },
  props: {
    options: {
      type: Object,
      required: true,
    },
    modelValue: {
      type: [Number, String, Object],
      required: false,
      default: -1,
    },
    dataTable: {
      type: Boolean,
      required: false,
      default: false,
    },
    parentValue: {
      type: Object,
      required: false,
      default: () => null,
    },
    valueAsObject: {
      type: Boolean,
      required: false,
      default: false,
      description: "If true, the modalValue will be an object",
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      currentData: null,
      isOpen: false,
      searchQuery: "",
      // Custom listbox (non-search mode)
      listOpen: false,
      activeIndex: -1,
      menuStyle: {},
      teleportTarget: "body",
      uid: uniqueId(),
    };
  },
  computed: {
    isDisabled() {
      return this.options.readOnly !== undefined || this.options.disabled !== undefined;
    },
    selectClass() {
      const option = this.selectOptions.find((c) => c.value === this.currentData);
      return option ? option.class : "";
    },
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    selectedProjectId() {
      return parseInt(this.$store.getters["settings/getValue"]("projects.default"));
    },
    selectOptions() {
      let baseOptions;

      if (Array.isArray(this.options.options)) {
        baseOptions = this.options.options;
      } else if (this.options.options.filter) {
        // Group filters by key: within each key group use OR, across groups use AND
        const filterGroups = this.options.options.filter.reduce((groups, f) => {
          const groupKey = f.key;
          if (!groups[groupKey]) groups[groupKey] = [];
          groups[groupKey].push(f);
          return groups;
        }, {});

        baseOptions = this.$store.getters["table/" + this.options.options.table + "/getFiltered"]((e) =>
          Object.values(filterGroups).every((group) =>
            group.some((f) => {
              let sourceValue = e[f.key];
              if (f.mapping) {
                sourceValue = f.mapping[e[f.key]];
              }
              switch (f.type) {
                case "formData":
                  return sourceValue === this.formData[f.value];
                case "parentData":
                  return sourceValue === this.parentValue[f.value];
                case "byUserId":
                  return sourceValue === this.userId;
                case "byProjectId":
                  return sourceValue === this.selectedProjectId;
                default:
                  if (typeof f.value === 'boolean' || typeof sourceValue === 'boolean') {
                    return Boolean(sourceValue) === Boolean(f.value);
                  }
                  return sourceValue === f.value;
              }
            })
          )
        );
      } else {
        baseOptions = this.$store.getters["table/" + this.options.options.table + "/getAll"];
      }

      if ((this.options.options?.prependNone || this.options.prependNone) && this.options.options?.table) {
        const valueKey = this.options.options.value || 'id';
        const nameKey = this.options.options.name || 'name';
        baseOptions = [{ [valueKey]: null, [nameKey]: this.$t('common.none') }, ...baseOptions];
      }

      // Filter according to additional Options and add to baseOptions
      if (this.options.options.additionalOptions) {
        const mappingFilter = this.options.options.filter.find((filter) => filter.type === "parentData");
        const mapping = mappingFilter?.mapping;

        // Determine parentType from parentValue
        const parentType = this.parentValue?.[mappingFilter?.value];

        // Filter `additionalOptions` to include only those matching the current `parentType`
        const additionalOptions = this.options.options.additionalOptions.filter((option) => {
          const stepType = mapping[option.type];
          return stepType === parentType;
        }).map((option) => {
          // Normalize to match vuex-table option shape (id/name/value lookup)
          const valueKey = this.options.options.value || 'id';
          const nameKey = this.options.options.name || 'name';
          return {
            ...option,
            [valueKey]: option.value,
            [nameKey]: option.name,
          };
        });

        baseOptions = [...baseOptions, ...additionalOptions];
      }

      if (this.formData?.isTemplateMode && this.options.options.table === 'document' && this.parentValue?.stepType === 1) {
        baseOptions = [{ id: null, name: this.$t('basic.form.placeholders.documentBracket') }, ...baseOptions];
      }

      // Add document templates (Type 5) to document dropdown for Editor steps in study creation
      if (
        this.options.options.table === 'document' &&
        this.parentValue?.stepType === 2 && 
        this.formData?.workflowId 
      ) {
        const currentUserId = this.$store.getters["auth/getUserId"];
        const documentTemplates = this.$store.getters["table/template/getAll"]
          .filter(t => t.type === 5 && !t.deleted && t.userId === currentUserId) // Type 5 = Document Template, own only
          .map(t => {
            const valueKey = this.options.options.value || 'id';
            const nameKey = this.options.options.name || 'name';
            return {
              [valueKey]: `template:${t.id}`,
              [nameKey]: `${t.name} ${this.$t('basic.form.placeholders.documentTemplateSuffix')}`,
              id: `template:${t.id}`,
              name: `${t.name} ${this.$t('basic.form.placeholders.documentTemplateSuffix')}`,
              value: `template:${t.id}`,
              isTemplateOption: true,
              templateId: t.id,
            };
          });
        
        baseOptions = [...baseOptions, ...documentTemplates];
      }

      return baseOptions;
    },
    filteredSelectOptions() {
      const query = this.searchQuery.trim().toLowerCase();
      if (!query) {
        return this.selectOptions;
      }
      return this.selectOptions.filter((option) =>
        String(option.name).toLowerCase().includes(query)
      );
    },
    hasSelection() {
      return this.currentData !== null
        && this.currentData !== undefined
        && this.currentData !== -1
        && this.currentData !== "";
    },
    selectedLabel() {
      const selected = this.selectOptions.find((option) => option.value === this.currentData);
      return selected?.name || this.options.placeholder || this.$t("common.selectPlaceholder");
    },
    /**
     * Options for the custom listbox in one shape. Array options use value/name; table options
     * use the configured keys (options.options.value / options.options.name).
     */
    listItems() {
      const fromTable = !Array.isArray(this.options.options);
      const valueKey = fromTable ? this.options.options.value : "value";
      const nameKey = fromTable ? this.options.options.name : "name";
      return (this.selectOptions || []).map((option) => ({
        value: option[valueKey],
        label: translateMaybeKey(option[nameKey]),
        class: option.class,
        disabled: !!option.disabled,
      }));
    },
    listSelectedIndex() {
      return this.listItems.findIndex((item) => item.value === this.currentData);
    },
    hasListSelection() {
      return this.listSelectedIndex >= 0;
    },
    listSelectedLabel() {
      const item = this.listItems[this.listSelectedIndex];
      return item ? item.label : (this.options.placeholder || this.$t("common.selectPlaceholder"));
    },
    listId() {
      return `care-select-list-${this.uid}`;
    },
  },
  watch: {
    currentData(newVal, oldVal) {
      if (newVal === oldVal) return;
      this.$emit("update:modelValue", this.emitValue(newVal));
    },
    modelValue(newVal) {
      const next = this.resolveCurrent(newVal);
      if (next === this.currentData && newVal !== -1) return;
      this.updateData();
    },
    isOpen(open) {
      if (open) {
        this.searchQuery = "";
        this.$nextTick(() => this.$refs.searchInput?.focus());
      } else {
        this.searchQuery = "";
      }
    },
  },
  created() {
    this.typeahead = createTypeahead();
  },
  mounted() {
    this.updateData();
    this.teleportTarget = popupTeleportTarget(this.$el);
    document.addEventListener("mousedown", this.onDocumentClick);
  },
  beforeUnmount() {
    document.removeEventListener("mousedown", this.onDocumentClick);
    this.unbindList?.();
  },
  methods: {
    // Native <select> must bind primitives. valueAsObject only affects the emitted/model shape.
    resolveCurrent(modelValue) {
      if (modelValue === -1) return -1;
      if (this.valueAsObject && modelValue && typeof modelValue === "object") {
        return modelValue.value;
      }
      return modelValue;
    },
    emitValue(current) {
      if (!this.valueAsObject) return current;
      if (current === -1 || current === null || current === undefined || current === "") {
        return null;
      }
      return this.selectOptions.find((option) => option.value === current) || null;
    },
    translateMaybeKey,
    updateData() {
      // Preserve explicit null selections (e.g., "New Empty Document") instead of auto-selecting the first option.
      if (this.modelValue === -1) {
        if (this.options.default) {
          this.currentData = this.options.default;
        } else {
          if (this.selectOptions && this.selectOptions.length > 0) {
            // in case we use a vuex table for the select options
            if (this.options.table) {
              this.currentData = this.selectOptions[0][this.options.options.value];
            } else {
              this.currentData = this.selectOptions[0].value;
            }
          }
        }
      } else {
        this.currentData = this.resolveCurrent(this.modelValue);
      }
    },
    selectOption(option, blur) {
      if (option.disabled) return;
      this.currentData = option.value;
      this.isOpen = false;
      blur(this.currentData !== -1);
    },
    onDocumentClick(event) {
      if (!this.isOpen) return;
      if (!this.$refs.searchSelect?.contains(event.target)) {
        this.isOpen = false;
      }
    },
    validate() {
      return this.$refs.formElement.validate(this.currentData);
    },

    // ---------- Custom listbox ----------
    /** Same validity rule the native selects used: arrays accept anything but -1, tables need an id > 0. */
    listBlurValue() {
      return Array.isArray(this.options.options) ? this.currentData !== -1 : this.currentData > 0;
    },
    optionDomId(index) {
      return `care-select-opt-${this.uid}-${index}`;
    },
    toggleList() {
      this.listOpen ? this.closeList() : this.openList();
    },
    openList() {
      if (this.listOpen || this.isDisabled) return;
      const enabled = this.listItems.findIndex((item) => !item.disabled);
      this.activeIndex = this.listSelectedIndex >= 0 ? this.listSelectedIndex : enabled;
      this.listOpen = true;
      this.updateMenuPosition();
      this.unbindList = bindPopupListeners({
        isInside: (target) => this.$refs.listTrigger?.contains(target) || this.$refs.listMenu?.contains(target),
        onOutside: () => this.closeList(false),
        onReposition: this.updateMenuPosition,
      });
      this.$nextTick(() => {
        this.updateMenuPosition();
        this.$refs.listMenu?.focus({preventScroll: true});
        this.scrollActiveIntoView();
      });
    },
    /**
     * @param {boolean} [focusButton] Return focus to the toggle button.
     * @returns {void}
     */
    closeList(focusButton = true) {
      if (!this.listOpen) return;
      this.listOpen = false;
      this.unbindList?.();
      this.unbindList = null;
      if (focusButton) this.$refs.listButton?.focus({preventScroll: true});
    },
    pickListItem(item, blur) {
      if (item.disabled) return;
      this.currentData = item.value;
      this.closeList();
      blur(this.listBlurValue());
    },
    onListBlur(blur) {
      // Focus moving into our own menu is not a blur of the field
      if (this.listOpen) return;
      blur(this.listBlurValue());
    },
    onMenuFocusout(blur, event) {
      const next = event.relatedTarget;
      if (next && (this.$refs.listTrigger?.contains(next) || this.$refs.listMenu?.contains(next))) return;
      this.closeList(false);
      blur(this.listBlurValue());
    },
    /** Pin the menu to the toggle button. @returns {void} */
    updateMenuPosition() {
      const button = this.$refs.listButton;
      if (!button) return;
      this.menuStyle = placePopup(button.getBoundingClientRect(), this.$refs.listMenu).style;
    },
    /**
     * @param {number} index
     * @returns {void}
     */
    setActive(index) {
      this.activeIndex = index;
      this.scrollActiveIntoView();
    },
    scrollActiveIntoView() {
      this.$nextTick(() => {
        this.$refs.listMenu?.querySelector(".care-select__option.is-active")?.scrollIntoView({block: "nearest"});
      });
    },
    onListButtonKeydown(event) {
      // Enter/Space already fire the button's click (toggleList)
      if (["ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        this.openList();
      } else if (event.key.length === 1 && event.key !== " " && !event.ctrlKey && !event.metaKey && !event.altKey) {
        // Closed + typing: change the value directly, like a native select
        const index = this.typeahead(event.key, this.listItems, this.activeIndex);
        if (index >= 0) {
          this.activeIndex = index;
          this.currentData = this.listItems[index].value;
        }
      }
    },
    /**
     * Keys while the menu is open.
     * @param {KeyboardEvent} event
     * @returns {void}
     */
    onListMenuKeydown(event) {
      handleListboxKeydown(event, {
        items: this.listItems,
        activeIndex: this.activeIndex,
        setActive: this.setActive,
        pick: (index) => {
          this.currentData = this.listItems[index].value;
          this.closeList();
        },
        close: this.closeList,
        typeahead: this.typeahead,
      });
    },
  },
};
</script>

<style scoped>
.searchable-select {
  position: relative;
}

.searchable-select-toggle {
  width: 100%;
  background-color: var(--bs-body-bg, #fff);
}

button.searchable-select-toggle {
  display: flex;
  align-items: center;
  overflow: hidden;
  cursor: pointer;
}

input.searchable-select-toggle {
  cursor: text;
}

.searchable-select-toggle:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.searchable-select-label {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.searchable-select-menu {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 1050;
  max-height: 16rem;
  display: flex;
  flex-direction: column;
  padding: 0.25rem 0;
  margin-top: 0.125rem;
}

.searchable-select-options {
  overflow-y: auto;
  max-height: 16rem;
}

/* Searchable variant: same row look as the listbox below */
.searchable-select-menu {
  padding: .25rem;
  border-radius: var(--care-radius-lg);
}

.searchable-select-options .dropdown-item {
  border-radius: var(--care-radius-sm);
}

/* ---------- Custom listbox ---------- */
.care-select {
  position: relative;
}

.care-select__toggle {
  display: flex;
  align-items: center;
  width: 100%;
  overflow: hidden;
  text-align: left;
  background-color: var(--bs-body-bg);
  cursor: pointer;
}

.care-select.is-open .care-select__toggle {
  border-color: var(--care-primary);
  box-shadow: var(--care-focus-ring);
}

.care-select__toggle:disabled {
  cursor: not-allowed;
  opacity: .65;
}

.care-select__label {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.care-select__menu {
  overflow-y: auto;
  font-size: var(--bs-body-font-size, 1rem);
  color: var(--bs-body-color);
  scrollbar-width: thin;
  scrollbar-color: rgba(var(--bs-secondary-rgb), .35) transparent;
}

[data-bs-theme="dark"] .care-select__menu {
  background: color-mix(in srgb, var(--bs-body-bg) 90%, #ffffff 10%);
}

/* Full-width rows: the highlight always spans the whole menu */
.care-select__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;
  width: 100%;
  padding: .45rem .65rem;
  border-radius: var(--care-radius-sm);
  cursor: pointer;
  user-select: none;
}

.care-select__option.is-active:not(.is-disabled) {
  background: rgba(var(--care-violet-rgb), .12);
  color: var(--bs-emphasis-color);
}

/* A colour option keeps its own tint. The row hover must not replace it. */
.care-select__toggle.border-info,
.care-select__option.border-info,
.searchable-select-toggle.border-info,
.dropdown-item.border-info {
  background-color: var(--bs-info-bg-subtle) !important;
  color: var(--bs-info-text-emphasis) !important;
  border: 1px solid var(--bs-info);
}

.care-select__toggle.border-warning,
.care-select__option.border-warning,
.searchable-select-toggle.border-warning,
.dropdown-item.border-warning {
  background-color: var(--bs-warning-bg-subtle) !important;
  color: var(--bs-warning-text-emphasis) !important;
  border: 1px solid var(--bs-warning);
}

.care-select__toggle.border-success,
.care-select__option.border-success,
.searchable-select-toggle.border-success,
.dropdown-item.border-success {
  background-color: var(--bs-success-bg-subtle) !important;
  color: var(--bs-success-text-emphasis) !important;
  border: 1px solid var(--bs-success);
}

.care-select__toggle.border-danger,
.care-select__option.border-danger,
.searchable-select-toggle.border-danger,
.dropdown-item.border-danger {
  background-color: var(--bs-danger-bg-subtle) !important;
  color: var(--bs-danger-text-emphasis) !important;
  border: 1px solid var(--bs-danger);
}

.care-select__option.is-selected {
  font-weight: 500;
  color: var(--care-primary);
}

.care-select__option.is-disabled {
  color: var(--bs-secondary-color);
  opacity: .6;
  cursor: not-allowed;
}

.care-select__option-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.care-select__check {
  flex: 0 0 auto;
}

.care-select-menu-enter-active,
.care-select-menu-leave-active {
  transition: opacity 110ms ease, transform 130ms var(--care-ease);
}

.care-select-menu-enter-from,
.care-select-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .care-select-menu-enter-active,
  .care-select-menu-leave-active {
    transition: none;
  }
}
</style>
