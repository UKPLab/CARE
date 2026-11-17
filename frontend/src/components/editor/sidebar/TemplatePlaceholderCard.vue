<template>
            <li
              class="list-group-item"
            >
              <div class="d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center flex-grow-1">
                  <div class="icon-container p-2 text-primary me-2">
                    <i :class="placeholder.icon"></i>
                  </div>
                  <div class="d-flex flex-column flex-grow-1">
                    <div class="d-flex align-items-center">
                      <h5 class="mb-0 me-1">{{ translateMaybeKey(placeholder.label) }}<span v-if="placeholder.required" class="text-danger ms-1">*</span></h5>
                      <FormHelp
                        v-if="placeholder.description"
                        :help="getPlaceholderHelp(placeholder)"
                      />
                    </div>
                    <p
                      v-if="placeholder.description"
                      class="mb-0 text-muted"
                    >
                      {{ translateMaybeKey(placeholder.description) }}
                    </p>
                    <div
                      v-if="hasPlaceholderOptions(placeholder)"
                      class="mt-2"
                    >
                      <div
                        v-for="(row, rowIndex) in getPendingOptionRows(placeholder.id)"
                        :key="`${placeholder.id}-option-${rowIndex}`"
                        class="d-flex align-items-center gap-2 mb-2"
                      >
                        <select
                          v-model="row.name"
                          class="form-select form-select-sm option-select"
                        >
                          <option value="">{{ $t("templates.placeholders.options.selectOption") }}</option>
                          <option
                            v-for="optionDef in placeholder.placeholderOptions"
                            :key="optionDef.name"
                            :value="optionDef.name"
                            :disabled="isOptionDisabled(placeholder, optionDef.name, rowIndex)"
                          >
                            {{ translateMaybeKey(optionDef.label) }}
                          </option>
                        </select>
                        <template v-if="isRangeOption(placeholder, row.name)">
                          <input
                            v-model="row.from"
                            type="number"
                            min="1"
                            class="form-control form-control-sm option-input"
                            :placeholder="$t('templates.placeholders.options.from')"
                          >
                          <span class="text-muted">–</span>
                          <input
                            v-model="row.to"
                            type="number"
                            min="1"
                            class="form-control form-control-sm option-input"
                            :placeholder="$t('templates.placeholders.options.to')"
                          >
                        </template>
                        <input
                          v-else-if="row.name"
                          v-model="row.value"
                          type="number"
                          min="1"
                          class="form-control form-control-sm option-input"
                          :placeholder="getOptionLabel(placeholder, row.name)"
                        >
                        <BasicButton
                          class="btn btn-outline-secondary btn-sm"
                          icon="dash-lg"
                          text=""
                          @click="removeOptionRow(placeholder.id, rowIndex)"
                        />
                      </div>
                      <BasicButton
                        class="btn btn-outline-primary btn-sm"
                        icon="plus-lg"
                        :text="$t('templates.placeholders.options.add')"
                        @click="addOptionRow(placeholder.id)"
                      />
                    </div>
                  </div>
                </div>
                <div class="d-flex align-items-center ms-2">
                  <span class="badge rounded-pill me-2 text-primary">{{ count }}</span>
                  <BasicButton
                    class="btn btn-primary btn-sm d-flex align-items-center"
                    icon="plus-lg"
                    :text="$t('common.add')"
                    @click="handlePlaceholderClick(placeholder)"
                  />
                </div>
              </div>
            </li>
</template>

<script>
import FormHelp from "@/basic/form/Help.vue";
import BasicButton from "@/basic/Button.vue";
import {translateMaybeKey} from "@/assets/utils";
import {formatPositiveIntegerRange, isPositiveIntegerOptionValue, isPositiveIntegerRangeOptionValue} from "placeholder-tokens";

/** A placeholder's pending insert options and its add action form one editable card. */
export default {
  name: 'TemplatePlaceholderCard',
  components: {FormHelp, BasicButton},
  props: {placeholder: {type: Object, required: true}, count: {type: Number, default: 0}, templateType: {type: Number, default: null}},
  emits: ['insert', 'clear-warnings'],
  data() { return {pendingOptionRowsByKey: {}}; },
  methods: {
    translateMaybeKey,
hasPlaceholderOptions(placeholder) {
        return Array.isArray(placeholder.placeholderOptions) && placeholder.placeholderOptions.length > 0;
      },
getPendingOptionRows(placeholderKey) {
        if (!this.pendingOptionRowsByKey[placeholderKey]) {
          this.pendingOptionRowsByKey[placeholderKey] = [];
        }
        return this.pendingOptionRowsByKey[placeholderKey];
      },
addOptionRow(placeholderKey) {
        const rows = this.getPendingOptionRows(placeholderKey);
        rows.push({ name: "", value: "", from: "", to: "" });
      },
removeOptionRow(placeholderKey, rowIndex) {
        const rows = this.getPendingOptionRows(placeholderKey);
        rows.splice(rowIndex, 1);
        this.$emit('clear-warnings');
      },
isRangeOption(placeholder, optionName) {
        const optionDef = this.getOptionDef(placeholder, optionName);
        return optionDef?.valueType === "positiveIntegerRange";
      },
isOptionDisabled(placeholder, optionName, currentRowIndex) {
        const rows = this.getPendingOptionRows(placeholder.id);
        return rows.some((row, index) => index !== currentRowIndex && row.name === optionName);
      },
getOptionLabel(placeholder, optionName) {
        const optionDef = (placeholder.placeholderOptions || []).find((entry) => entry.name === optionName);
        return optionDef ? translateMaybeKey(optionDef.label) : optionName;
      },
getOptionDef(placeholder, optionName) {
        return (placeholder.placeholderOptions || []).find((entry) => entry.name === optionName);
      },
isValidOptionValue(optionDef, value) {
        if (!optionDef) {
          return false;
        }
        if (optionDef.valueType === "positiveInteger") {
          return isPositiveIntegerOptionValue(value);
        }
        if (optionDef.valueType === "positiveIntegerRange") {
          return isPositiveIntegerRangeOptionValue(value);
        }
        return value !== undefined && value !== null && String(value).trim() !== "";
      },
collectSelectedOptions(placeholder) {
        const rows = this.getPendingOptionRows(placeholder.id);
        const selectedOptions = {};
        const applyWarnings = [];

        rows.forEach((row) => {
          if (!row.name) {
            if (
              (row.value !== "" && row.value != null)
              || (row.from !== "" && row.from != null)
              || (row.to !== "" && row.to != null)
            ) {
              applyWarnings.push(this.$t("templates.placeholders.options.warnings.valueWithoutOption"));
            }
            return;
          }
          const optionDef = this.getOptionDef(placeholder, row.name);
          if (!optionDef) {
            applyWarnings.push(this.$t("templates.placeholders.options.warnings.unknownOption", {
              placeholder: translateMaybeKey(placeholder.label),
            }));
            return;
          }
          const optionLabel = translateMaybeKey(optionDef.label);
          const optionValue = optionDef.valueType === "positiveIntegerRange"
            ? formatPositiveIntegerRange(row.from, row.to)
            : (row.value === undefined || row.value === null ? "" : String(row.value).trim());
          if (!this.isValidOptionValue(optionDef, optionValue)) {
            if (!optionValue) {
              applyWarnings.push(this.$t("templates.placeholders.options.warnings.noValue", { option: optionLabel }));
            } else {
              applyWarnings.push(this.$t("templates.placeholders.options.warnings.invalidValue", { option: optionLabel }));
            }
            return;
          }
          if (Object.prototype.hasOwnProperty.call(selectedOptions, row.name)) {
            applyWarnings.push(this.$t("templates.placeholders.options.warnings.alreadySet", { option: optionLabel }));
            return;
          }
          selectedOptions[row.name] = optionValue;
        });

        return { selectedOptions, applyWarnings };
      },
getPlaceholderHelp(placeholder) {
        const typeSlug = {
          1: "emailGeneral",
          2: "emailStudySession",
          3: "emailAssignment",
          6: "emailStudyClose",
          7: "emailSubmissionUpload",
          8: "prompt",
        }[this.templateType];
        if (typeSlug && placeholder.id) {
          const helpKey = `templates.placeholders.help.${typeSlug}.${placeholder.id}`;
          if (this.$te(helpKey)) {
            return this.$t(helpKey);
          }
        }
        return translateMaybeKey(placeholder.description);
      },
    handlePlaceholderClick(placeholder) {
      this.$emit('insert', {placeholder, ...this.collectSelectedOptions(placeholder)});
      if (this.hasPlaceholderOptions(placeholder)) this.pendingOptionRowsByKey[placeholder.id] = [];
    },
  },
};
</script>

<style scoped>
.list-group-item {
    padding: 0.825rem;
  }

.list-group-item:last-child {
    padding-bottom: 1.5rem;
  }

.icon-container {
    width: var(--icon-container-size);
    height: var(--icon-container-size);
    display: flex;
    margin-right: 0.625rem;
    align-items: center;
    justify-content: center;
    color: var(--bs-body-color);
    background-color: var(--bg-color);
  }

.list-group-item:hover {
    background-color: var(--bs-tertiary-bg, #f8f9fa);
  }

.badge {
    background-color: var(--bg-color);
  }

.option-select {
    max-width: 11rem;
  }

.option-input {
    max-width: 5.5rem;
  }
</style>
