<template>
<ul
        v-if="menuOpen && suggestions.length > 0"
        :ref="el => controller.setSearchRef('suggestionList',el)"
        class="dropdown-menu show token-suggestions"
        @mouseleave="controller.hoverIndex = -1"
      >
        <li
          v-for="(suggestion, index) in suggestions"
          :key="controller.stage + '_' + suggestion.value"
        >
          <button
            :class="{
              hovered: index === controller.hoverIndex,
              'keyboard-focus': index === controller.highlight,
            }"
            class="dropdown-item token-suggestion"
            type="button"
            @mousedown.prevent="pickSuggestion(suggestion)"
            @mouseenter="onSuggestionHover(index)"
          >
            <span :class="{'token-suggestion-symbol': !!suggestion.hint}">{{ suggestion.label }}</span>
            <span
              v-if="suggestion.hint"
              class="token-suggestion-hint"
            >{{ suggestion.hint }}</span>
          </button>
        </li>
      </ul>
<div
        v-else-if="menuOpen && showDatePicker"
        class="dropdown-menu show token-suggestions token-suggestions-form-date"
      >
        <DatetimePicker
          :model-value="controller.formDateValue"
          :options="controller.formDatePickerOptions"
          date-only
          @update:model-value="onFormDatePicked"
        />
      </div>
</template>
<script>

import { OPERATOR_HINTS, DATE_OPERATOR_HINTS, keyLabel, operatorsFor, optionsFor, parseIsoDate } from "../searchTokens.js";
import DatetimePicker from "@/basic/form/DatetimePicker.vue";
function localIsoDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}
function pad2(value) {
  return String(value).padStart(2, "0");
}
export default {
name:"TableSearchSuggestionsMenu",
components:{DatetimePicker},
inject:{controller:{from:"tableSearchController"}},
computed:{
suggestions() {
      if (!this.controller.hasSchema) return [];
      if (this.controller.stage === "operator" && this.controller.pending.key) {
        const typed = this.controller.draft.trim();
        const type = this.controller.schema[this.controller.pending.key]?.type;
        const hints = type === "date" ? DATE_OPERATOR_HINTS : OPERATOR_HINTS;
        return operatorsFor(this.controller.schema, this.controller.pending.key)
          .filter((operator) => !typed || operator.startsWith(typed))
          .map((operator) => ({
            type: "operator",
            value: operator,
            label: operator,
            hint: hints[operator] ? this.controller.$t(hints[operator]) : "",
          }));
      }
      if (this.controller.stage === "value" && this.controller.pending.key) {
        return optionsFor(this.controller.schema, this.controller.pending.key, this.controller.$t.bind(this.controller))
          .filter((option) => this.matchesDraft(option.label))
          .map((option) => ({type: "value", value: option.value, label: option.label}));
      }
      return Object.keys(this.controller.schema)
        .filter((key) => !this.controller.tokens.some((token) => token.key === key))
        .filter((key) => this.matchesDraft(keyLabel(this.controller.schema, key)) || this.matchesDraft(key))
        .map((key) => ({type: "key", value: key, label: keyLabel(this.controller.schema, key)}));
    },
showDatePicker() {
      return this.controller.stage === "value"
        && !!this.controller.pending.key
        && this.controller.schema[this.controller.pending.key]?.type === "date";
    },
menuOpen() {
      return this.controller.suggestionsOpen && (this.suggestions.length > 0 || this.showDatePicker);
    }},
watch:{"controller.suggestionsOpen": function(open) {
      if (open) this.syncMenuPosition();
    },
"controller.tokens": {
      handler() {
        if (this.controller.suggestionsOpen) this.syncMenuPosition();
      },
      deep: true,
    },
"controller.pending": {
      handler() {
        if (this.controller.suggestionsOpen) this.syncMenuPosition();
      },
      deep: true,
    },
showDatePicker(open) {
      if (open) {
        this.syncMenuPosition();
        const day = parseIsoDate(this.controller.draft.trim());
        this.controller.formDateValue = day ? `${day}T00:00:00` : null;
      }
    }},
methods:{
matchesDraft(label) {
      const needle = this.controller.draft.trim().toLowerCase();
      if (!needle) return true;
      return String(label).toLowerCase().includes(needle);
    },
onFormDatePicked(iso) {
      if (!iso) return;
      this.controller.commitPending(localIsoDate(new Date(iso)));
      this.controller.highlight = -1;
      this.controller.hoverIndex = -1;
      this.controller.suggestionsOpen = true;
      this.controller.focusDraft("end");
    },
syncMenuPosition() {
      this.controller.$nextTick(() => {
        const field = this.controller.searchRefs.tokenField;
        const input = this.controller.searchRefs.input;
        if (!field || !input) return;
        const fieldRect = field.getBoundingClientRect();
        const inputRect = input.getBoundingClientRect();
        this.controller.menuLeft = Math.max(0, Math.round(inputRect.left - fieldRect.left));
      });
    },
closeSuggestions() {
      this.controller.suggestionsOpen = false;
      this.controller.highlight = -1;
      this.controller.hoverIndex = -1;
    },
onSuggestionHover(index) {
      this.controller.hoverIndex = index;
    },
moveHighlight(delta) {
      this.controller.suggestionsOpen = true;
      const count = this.suggestions.length;
      if (count === 0) {
        this.controller.highlight = -1;
        return;
      }
      if (this.controller.highlight === -1) {
        this.controller.highlight = delta > 0 ? 0 : count - 1;
      } else {
        this.controller.highlight = (this.controller.highlight + delta + count) % count;
      }
      this.controller.$nextTick(() => {
        this.scrollHighlightIntoView();
      });
    },
scrollHighlightIntoView() {
      const list = this.controller.searchRefs.suggestionList;
      const item = list?.children?.[this.controller.highlight];
      if (!list || !item || this.controller.highlight < 0) return;
      const listRect = list.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      if (itemRect.top < listRect.top) {
        list.scrollTop -= listRect.top - itemRect.top;
      } else if (itemRect.bottom > listRect.bottom) {
        list.scrollTop += itemRect.bottom - listRect.bottom;
      }
    },
pickSuggestion(suggestion) {
      if (suggestion.type === "key") {
        this.controller.pending = {key: suggestion.value, operator: null};
        this.controller.draft = "";
        const operators = operatorsFor(this.controller.schema, suggestion.value);
        if (operators.length === 1) {
          this.controller.pending.operator = operators[0];
          this.controller.stage = "value";
        } else {
          this.controller.stage = "operator";
        }
      } else if (suggestion.type === "operator") {
        this.controller.pending.operator = suggestion.value;
        this.controller.stage = "value";
      } else {
        this.controller.commitPending(suggestion.value);
      }
      this.controller.highlight = -1;
      this.controller.hoverIndex = -1;
      this.controller.suggestionsOpen = true;
      this.controller.focusDraft("end");
    }
}
};
</script>

<style scoped>
.token-suggestions {
  --bs-dropdown-padding-y: 0;
  --bs-dropdown-padding-x: 0;
  position: absolute;
  top: calc(100% + 0.25rem);
  left: var(--token-menu-left, 0px);
  z-index: 1000;
  max-height: 16rem;
  margin: 0;
  padding: 0;
  overflow-x: hidden;
  overflow-y: auto;
  list-style: none;
  scrollbar-width: thin;
  scrollbar-gutter: stable;
}
.token-suggestions > li {
  margin: 0;
  padding: 0 10px 0 0;
}
.token-suggestions .dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin: 0;
  color: inherit;
  background-color: transparent;
  box-shadow: none;
}
.token-suggestion-symbol {
  font-family: var(--bs-font-monospace, monospace);
}
.token-suggestion-hint {
  margin-left: auto;
  color: var(--bs-secondary-color, #6c757d);
}
.token-suggestions .dropdown-item:hover,
.token-suggestions .dropdown-item.hovered {
  color: inherit;
  background-color: transparent;
  box-shadow: inset 0 0 0 2px #222;
  border-radius: 0.25rem;
}
.token-suggestions .dropdown-item.keyboard-focus,
.token-suggestions .dropdown-item.keyboard-focus:focus {
  color: inherit;
  background-color: #e0e0e0;
  box-shadow: inset 2px 0 0 #222;
  border-radius: 0;
}
.token-suggestions .dropdown-item.keyboard-focus:hover,
.token-suggestions .dropdown-item.keyboard-focus.hovered {
  color: inherit;
  background-color: #e0e0e0;
  box-shadow: inset 2px 0 0 #222, inset 0 0 0 2px #222;
  border-radius: 0.25rem;
}
.token-suggestions-form-date {
  padding: 0.5rem 0.65rem;
  min-width: 18rem;
}
</style>
