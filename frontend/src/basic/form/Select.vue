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
      <select
        v-else-if="Array.isArray(options.options)"
        v-model="currentData"
        :class="selectClass"
        class="form-select"
        @blur="blur(currentData !== -1)"
      >
        <option
          v-for="option in selectOptions"
          :key="option.value"
          :class="option.class"
          :value="option.value"
          :disabled="option.disabled"
        >
          {{ translateMaybeKey(option.name) }}
        </option>
      </select>
      <select
        v-else
        v-model="currentData"
        class="form-select"
        @blur="blur(currentData > 0)"
      >
        <option
          v-for="option in selectOptions"
          :key="option.id"
          :value="option[options.options.value]"
        >
          {{ translateMaybeKey(option[options.options.name]) }}
        </option>
      </select>
    </template>
  </FormElement>
</template>

<script>
import FormElement from "@/basic/form/Element.vue";
import { translateMaybeKey } from "@/assets/utils";

export default {
  name: "FormSelect",
  components: { FormElement },
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
      return selected?.name || this.options.placeholder || "Select...";
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
  mounted() {
    this.updateData();
    document.addEventListener("mousedown", this.onDocumentClick);
  },
  beforeUnmount() {
    document.removeEventListener("mousedown", this.onDocumentClick);
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
</style>
