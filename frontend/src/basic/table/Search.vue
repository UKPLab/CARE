<template>
  <div class="input-group input-group-sm table-search">
    <span
      id="search-addon1"
      class="input-group-text"
    >
      <LoadIcon icon-name="search" />
    </span>
    <div
      ref="tokenField"
      :style="{'--token-menu-left': `${menuLeft}px`}"
      class="form-control token-field d-flex flex-wrap align-items-center"
      @click="onFieldClick"
    >
      <span
        v-if="tokens.length > 0"
        ref="leadingGap"
        aria-label="before-filters"
        class="token-gap token-gap-leading"
        tabindex="0"
        @click.stop
        @keydown="onLeadingGapKeydown"
        @paste.prevent="onGapPaste"
      />
      <template
        v-for="(token, index) in tokens"
        :key="token.uid"
      >
        <!-- Caret inside a filter: show the raw token so it can be edited in place. -->
        <input
          v-if="editIndex === index"
          ref="editInput"
          v-model="editText"
          :style="{width: rawWidth}"
          aria-label="filter-token"
          class="token-raw"
          type="text"
          @blur="onRawBlur"
          @keydown="onRawKeydown($event, index)"
          @keydown.enter.prevent="commitRaw(true)"
          @keydown.esc.prevent="commitRaw(true)"
        />
        <span
          v-else
          class="badge rounded-pill token-chip d-inline-flex align-items-center gap-1"
          @click.stop="expandToken(index, 'end')"
        >
          {{ chipLabel(token) }}
          <LoadIcon
            :size="10"
            cursor="pointer"
            icon-name="x"
            @click.stop="removeTokenAt(index)"
          />
        </span>
        <!-- Slot after this chip: caret sits here without entering the next filter. -->
        <span
          :ref="(el) => bindGapRef(index, el)"
          aria-label="between-filters"
          class="token-gap"
          tabindex="0"
          @click.stop
          @keydown="onGapKeydown(index, $event)"
          @paste.prevent="onGapPaste"
        />
      </template>
      <span
        v-if="pending.key"
        class="badge rounded-pill token-chip token-chip-pending d-inline-flex align-items-center gap-1"
      >
        {{ pendingLabel }}
        <LoadIcon
          :size="10"
          cursor="pointer"
          icon-name="x"
          @click.stop="resetPending"
        />
      </span>
      <span class="token-compose">
        <input
          ref="input"
          v-model="draft"
          :placeholder="inputPlaceholder"
          aria-describedby="search-addon1"
          aria-label="table-search"
          class="token-input"
          type="text"
          @focus="onFocus"
          @blur="closeSuggestions"
          @click.stop
          @keydown.down.prevent="moveHighlight(1)"
          @keydown.up.prevent="moveHighlight(-1)"
          @keydown.enter.prevent="onEnter"
          @keydown.left="onDraftLeft"
          @keydown.right="onDraftRight"
          @keydown.esc="closeSuggestions"
          @keydown.delete="onBackspace"
          @paste.prevent="onPaste"
        />
      </span>
      <ul
        v-if="menuOpen && suggestions.length > 0"
        ref="suggestionList"
        class="dropdown-menu show token-suggestions"
        @mouseleave="hoverIndex = -1"
      >
        <li
          v-for="(suggestion, index) in suggestions"
          :key="stage + '_' + suggestion.value"
        >
          <button
            :class="{
              hovered: index === hoverIndex,
              'keyboard-focus': index === highlight,
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
        class="dropdown-menu show token-suggestions token-suggestions-date"
        @mousedown.prevent
      >
        <div class="token-date-picker">
          <div class="token-date-picker-head">
            <button
              :disabled="!canShiftPicker(-1)"
              aria-label="Previous"
              class="token-date-nav"
              type="button"
              @click="shiftPicker(-1)"
            >
              <LoadIcon
                :size="12"
                icon-name="chevron-left"
              />
            </button>
            <div class="token-date-picker-titles">
              <button
                v-if="pickerView === 'days'"
                class="token-date-title-btn"
                type="button"
                @click="pickerView = 'months'"
              >
                {{ pickerMonthLabel }}
              </button>
              <button
                v-if="pickerView !== 'years'"
                class="token-date-title-btn"
                type="button"
                @click="pickerView = 'years'"
              >
                {{ pickerYear }}
              </button>
              <span
                v-else
                class="token-date-picker-title"
              >{{ pickerYearRangeLabel }}</span>
            </div>
            <button
              :disabled="!canShiftPicker(1)"
              aria-label="Next"
              class="token-date-nav"
              type="button"
              @click="shiftPicker(1)"
            >
              <LoadIcon
                :size="12"
                icon-name="chevron-right"
              />
            </button>
          </div>
          <div
            v-if="pickerView === 'days'"
            class="token-date-picker-grid"
          >
            <span
              v-for="weekday in weekdays"
              :key="weekday"
              class="token-date-picker-dow"
            >{{ weekday }}</span>
            <template
              v-for="(week, weekIndex) in pickerWeeks"
              :key="weekIndex"
            >
              <button
                v-for="cell in week"
                :key="cell.value"
                :aria-label="cell.value"
                :class="{
                  muted: !cell.inMonth,
                  'is-today': cell.isToday,
                  'is-selected': cell.isSelected,
                }"
                :disabled="cell.disabled"
                class="token-date-picker-day"
                type="button"
                @click="pickPickerDate(cell.value)"
              >
                {{ cell.day }}
              </button>
            </template>
          </div>
          <div
            v-else-if="pickerView === 'months'"
            class="token-date-picker-grid token-date-picker-grid-months"
          >
            <button
              v-for="(name, index) in monthShortNames"
              :key="name"
              :class="{'is-selected': index === pickerMonth}"
              :disabled="isFutureMonth(pickerYear, index)"
              class="token-date-picker-cell"
              type="button"
              @click="pickPickerMonth(index)"
            >
              {{ name }}
            </button>
          </div>
          <div
            v-else
            class="token-date-picker-grid token-date-picker-grid-years"
          >
            <button
              v-for="year in pickerYears"
              :key="year"
              :class="{'is-selected': year === pickerYear}"
              :disabled="year > currentYear"
              class="token-date-picker-cell"
              type="button"
              @click="pickPickerYear(year)"
            >
              {{ year }}
            </button>
          </div>
        </div>
      </div>
    </div>
    <button
      v-if="hasBarQuery"
      :title="copied ? 'Query copied' : 'Copy this search query'"
      class="btn btn-outline-secondary search-bar-btn"
      type="button"
      @click="copyQuery"
    >
      <LoadIcon :icon-name="copied ? 'check' : 'clipboard'" />
    </button>
    <button
      v-if="hasBarQuery"
      class="btn btn-outline-secondary search-bar-btn"
      title="Clear search"
      type="button"
      @click="clearAll"
    >
      <LoadIcon icon-name="x-lg" />
    </button>
    <slot name="additional-buttons" />
  </div>
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";
import {
  OPERATOR_LABELS,
  OPERATOR_HINTS,
  DATE_OPERATOR_HINTS,
  coerceValue,
  defaultOperator,
  keyLabel,
  needsTypedValue,
  operatorsFor,
  optionsFor,
  parseQuery,
  parseIsoDate,
  parseToken,
  serializeToken,
  tokenLabel,
  unquote,
} from "./searchTokens.js";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pad2(value) {
  return String(value).padStart(2, "0");
}

function localIsoDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/**
 * Table search bar with GitLab-style filter tokens.
 *
 * Tokens can be picked from the dropdown or typed/pasted as `key:operator value`; both become
 * chips and serialize back to a copyable string. Caret leaving a chip lands in the gap between
 * filters first so Backspace drops the whole token. Schema is per table; this component only
 * knows the generic token types in searchTokens.js. Empty schema → plain search input.
 */
export default {
  name: "BasicTableSearch",
  components: {LoadIcon},
  props: {
    /** `{search, columnFilters}` — columnFilters maps a schema key to `{operator, value}` */
    modelValue: {
      type: Object,
      required: false,
      default: () => ({search: "", columnFilters: {}}),
    },
    /** Filterable keys of this table; empty means free-text search only */
    schema: {
      type: Object,
      required: false,
      default: () => ({}),
    },
    placeholder: {
      type: String,
      required: false,
      default: "Type to filter table...",
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      tokens: [],
      draft: "",
      suggestionsOpen: false,
      stage: "key", // key → operator → value
      pending: {key: null, operator: null},
      highlight: -1, // keyboard focus in the suggestion list; -1 = arrows have not landed
      hoverIndex: -1, // pointer hover; separate from keyboard so the two styles do not mix
      editIndex: null, // token currently expanded to its raw form
      editText: "",
      movingFocus: false, // suppresses blur handlers while focus moves between zones
      uidCounter: 0,
      copied: false,
      copiedTimer: null,
      menuLeft: 0,
      pickerYear: new Date().getFullYear(),
      pickerMonth: new Date().getMonth(),
      pickerView: "days",
    };
  },
  computed: {
    hasSchema() {
      return Object.keys(this.schema).length > 0;
    },
    inputPlaceholder() {
      // A picked operator on a typed-value key (Sessions ≥ …) is not a filter until a value arrives.
      if (this.stage === "value" && this.pending.key && needsTypedValue(this.schema, this.pending.key)) {
        const type = this.schema[this.pending.key].type;
        if (type === "numeric") return "Type a number, then Enter or Space";
        if (type === "date") return "Pick a date or type YYYY-MM-DD";
        return "Type a value, then Enter or Space";
      }
      if (this.tokens.length > 0 || this.pending.key) return "";
      return this.hasSchema ? "Search or filter..." : this.placeholder;
    },
    payload() {
      const columnFilters = {};
      this.tokens.forEach((token) => {
        columnFilters[token.key] = {operator: token.operator, value: token.value};
      });
      // A value typed for a pending filter (Sessions = 5) is not free-text search.
      return {search: this.pending.key ? "" : this.draft.trim(), columnFilters};
    },
    hasBarQuery() {
      return this.tokens.length > 0 || !!this.draft.trim() || !!this.pending.key;
    },
    queryString() {
      const parts = this.tokens.map((token) => serializeToken(this.schema, token));
      if (this.pending.key) {
        const pending = this.pending.operator
          ? `${this.pending.key}:${this.pending.operator}`
          : this.pending.key;
        parts.push(pending);
        if (this.draft.trim()) parts.push(this.draft.trim());
      } else if (this.draft.trim()) {
        parts.push(this.draft.trim());
      }
      return parts.join(" ");
    },
    rawWidth() {
      return `${Math.max(this.editText.length, 2) + 1}ch`;
    },
    pendingLabel() {
      if (!this.pending.key) return "";
      const operator = this.pending.operator ? OPERATOR_LABELS[this.pending.operator] : "";
      return `${keyLabel(this.schema, this.pending.key)} ${operator}`.trim();
    },
    suggestions() {
      if (!this.hasSchema) return [];
      if (this.stage === "operator" && this.pending.key) {
        const typed = this.draft.trim();
        const type = this.schema[this.pending.key]?.type;
        const hints = type === "date" ? DATE_OPERATOR_HINTS : OPERATOR_HINTS;
        return operatorsFor(this.schema, this.pending.key)
          .filter((operator) => !typed || operator.startsWith(typed))
          .map((operator) => ({
            type: "operator",
            value: operator,
            label: operator,
            hint: hints[operator] || "",
          }));
      }
      if (this.stage === "value" && this.pending.key) {
        return optionsFor(this.schema, this.pending.key)
          .filter((option) => this.matchesDraft(option.label))
          .map((option) => ({type: "value", value: option.value, label: option.label}));
      }
      return Object.keys(this.schema)
        .filter((key) => !this.tokens.some((token) => token.key === key))
        .filter((key) => this.matchesDraft(keyLabel(this.schema, key)) || this.matchesDraft(key))
        .map((key) => ({type: "key", value: key, label: keyLabel(this.schema, key)}));
    },
    showDatePicker() {
      return this.stage === "value"
        && !!this.pending.key
        && this.schema[this.pending.key]?.type === "date";
    },
    weekdays() {
      return WEEKDAYS;
    },
    menuOpen() {
      return this.suggestionsOpen && (this.suggestions.length > 0 || this.showDatePicker);
    },
    todayIso() {
      return localIsoDate(new Date());
    },
    currentYear() {
      return new Date().getFullYear();
    },
    currentMonth() {
      return new Date().getMonth();
    },
    typedDate() {
      return parseIsoDate(this.draft.trim());
    },
    pickerMonthLabel() {
      return MONTH_NAMES[this.pickerMonth];
    },
    monthShortNames() {
      return MONTH_SHORT;
    },
    pickerYearBlockStart() {
      return Math.floor(this.pickerYear / 12) * 12;
    },
    pickerYears() {
      const start = this.pickerYearBlockStart;
      return Array.from({length: 12}, (_, index) => start + index);
    },
    pickerYearRangeLabel() {
      const start = this.pickerYearBlockStart;
      return `${start}–${start + 11}`;
    },
    pickerWeeks() {
      const year = this.pickerYear;
      const month = this.pickerMonth;
      const first = new Date(year, month, 1);
      const lead = (first.getDay() + 6) % 7;
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const cells = [];
      for (let offset = 0; offset < lead; offset += 1) {
        cells.push(this.pickerCell(new Date(year, month, 1 - (lead - offset)), false));
      }
      for (let day = 1; day <= daysInMonth; day += 1) {
        cells.push(this.pickerCell(new Date(year, month, day), true));
      }
      let next = 1;
      while (cells.length % 7 !== 0) {
        cells.push(this.pickerCell(new Date(year, month + 1, next), false));
        next += 1;
      }
      const weeks = [];
      for (let index = 0; index < cells.length; index += 7) {
        weeks.push(cells.slice(index, index + 7));
      }
      return weeks;
    },
  },
  watch: {
    draft() {
      if (this.tryFinishPendingValue()) return;
      if (this.tryResolvePendingOperator()) return;
      // A trailing space ends a typed token — turn it into a chip before it reaches free-text search.
      if (/\s$/.test(this.draft)) {
        this.absorbTokens();
      }
      this.tryPromoteDraftKey();
      this.highlight = -1;
      this.hoverIndex = -1;
      this.syncPickerMonth();
      this.emitUpdate();
    },
    /** Editing the raw form applies straight away, so `>=5` → `>=6` refilters while you type. */
    editText(text) {
      if (this.editIndex === null) return;
      const current = this.tokens[this.editIndex];
      const parsed = parseToken(this.schema, text.trim());
      if (!current || !parsed) return;
      if (current.key === parsed.key && current.operator === parsed.operator && current.value === parsed.value) {
        return;
      }
      this.tokens.splice(this.editIndex, 1, {...parsed, uid: current.uid});
      this.emitUpdate();
    },
    modelValue: {
      handler(value) {
        if (JSON.stringify(value || {}) === JSON.stringify(this.payload)) return;
        this.hydrate(value);
      },
      deep: true,
    },
    suggestionsOpen(open) {
      if (open) this.syncMenuPosition();
    },
    tokens: {
      handler() {
        if (this.suggestionsOpen) this.syncMenuPosition();
      },
      deep: true,
    },
    pending: {
      handler() {
        if (this.suggestionsOpen) this.syncMenuPosition();
      },
      deep: true,
    },
    showDatePicker(open) {
      if (open) {
        this.pickerView = "days";
        this.syncPickerMonth(true);
        this.syncMenuPosition();
      }
    },
  },
  created() {
    this.gapEls = Object.create(null);
    this.skipDraftPromote = false; // Left from a pending chip must not immediately revive it
  },
  mounted() {
    this.hydrate(this.modelValue);
  },
  beforeUnmount() {
    clearTimeout(this.copiedTimer);
  },
  methods: {
    chipLabel(token) {
      return tokenLabel(this.schema, token);
    },
    pickerCell(date, inMonth) {
      const value = localIsoDate(date);
      return {
        value,
        day: date.getDate(),
        inMonth,
        isToday: value === this.todayIso,
        isSelected: value === this.typedDate,
        disabled: value > this.todayIso,
      };
    },
    isFutureMonth(year, month) {
      return year > this.currentYear || (year === this.currentYear && month > this.currentMonth);
    },
    canShiftPicker(delta) {
      if (delta < 0) return true;
      if (this.pickerView === "days") {
        const next = new Date(this.pickerYear, this.pickerMonth + 1, 1);
        return !this.isFutureMonth(next.getFullYear(), next.getMonth());
      }
      if (this.pickerView === "months") {
        return this.pickerYear < this.currentYear;
      }
      return this.pickerYearBlockStart + 12 <= this.currentYear;
    },
    shiftPicker(delta) {
      if (!this.canShiftPicker(delta)) return;
      if (this.pickerView === "days") {
        const date = new Date(this.pickerYear, this.pickerMonth + delta, 1);
        this.pickerYear = date.getFullYear();
        this.pickerMonth = date.getMonth();
        return;
      }
      if (this.pickerView === "months") {
        this.pickerYear += delta;
        return;
      }
      this.pickerYear = this.pickerYearBlockStart + (delta * 12);
    },
    pickPickerMonth(month) {
      if (this.isFutureMonth(this.pickerYear, month)) return;
      this.pickerMonth = month;
      this.pickerView = "days";
    },
    pickPickerYear(year) {
      if (year > this.currentYear) return;
      this.pickerYear = year;
      if (this.isFutureMonth(year, this.pickerMonth)) {
        this.pickerMonth = this.currentMonth;
      }
      this.pickerView = "months";
    },
    syncPickerMonth(force = false) {
      if (!this.showDatePicker && !force) return;
      const day = parseIsoDate(this.draft.trim());
      if (day) {
        this.pickerYear = Number(day.slice(0, 4));
        this.pickerMonth = Number(day.slice(5, 7)) - 1;
        return;
      }
      if (!force) return;
      const now = new Date();
      this.pickerYear = now.getFullYear();
      this.pickerMonth = now.getMonth();
    },
    pickPickerDate(value) {
      if (value > this.todayIso) return;
      this.commitPending(value);
      this.highlight = -1;
      this.hoverIndex = -1;
      this.suggestionsOpen = true;
      this.focusDraft("end");
    },
    matchesDraft(label) {
      const needle = this.draft.trim().toLowerCase();
      if (!needle) return true;
      return String(label).toLowerCase().includes(needle);
    },
    nextUid() {
      this.uidCounter += 1;
      return this.uidCounter;
    },
    rawInput() {
      const ref = this.$refs.editInput;
      return Array.isArray(ref) ? ref[0] : ref;
    },
    bindGapRef(index, el) {
      if (el) {
        this.gapEls[index] = el;
      } else {
        delete this.gapEls[index];
      }
    },
    focusDraft(caret = "end") {
      this.$nextTick(() => {
        const el = this.$refs.input;
        if (el) {
          el.focus();
          const position = caret === "start" ? 0 : el.value.length;
          el.setSelectionRange(position, position);
        }
        this.movingFocus = false;
      });
    },
    /** Caret after token `index`, or before the first chip when `index` is -1. Chips stay collapsed. */
    focusGap(index) {
      this.movingFocus = true;
      this.closeSuggestions();
      this.$nextTick(() => {
        const el = index < 0 ? this.$refs.leadingGap : this.gapEls[index];
        if (el && (index < 0 || index < this.tokens.length)) {
          el.focus();
          this.movingFocus = false;
          return;
        }
        this.focusDraft("start");
      });
    },
    onFocus() {
      if (!this.pending.key) this.stage = "key";
      this.suggestionsOpen = true;
      this.syncMenuPosition();
    },
    /** Clicking the field background focuses the draft; clicks inside the input keep a text selection. */
    onFieldClick(event) {
      if (event.target.closest(".token-input, .token-raw, .token-chip, .token-gap, .token-suggestions")) {
        return;
      }
      this.focusDraft("end");
    },
    /** Dropdown sits under the whole search field, aligned with the empty input after chips. */
    syncMenuPosition() {
      this.$nextTick(() => {
        const field = this.$refs.tokenField;
        const input = this.$refs.input;
        if (!field || !input) return;
        const fieldRect = field.getBoundingClientRect();
        const inputRect = input.getBoundingClientRect();
        this.menuLeft = Math.max(0, Math.round(inputRect.left - fieldRect.left));
      });
    },
    closeSuggestions() {
      this.suggestionsOpen = false;
      this.highlight = -1;
      this.hoverIndex = -1;
    },
    onSuggestionHover(index) {
      this.hoverIndex = index;
    },
    moveHighlight(delta) {
      this.suggestionsOpen = true;
      const count = this.suggestions.length;
      if (count === 0) {
        this.highlight = -1;
        return;
      }
      if (this.highlight === -1) {
        this.highlight = delta > 0 ? 0 : count - 1;
      } else {
        this.highlight = (this.highlight + delta + count) % count;
      }
      this.$nextTick(() => {
        this.scrollHighlightIntoView();
      });
    },
    /** Scroll only the suggestion list — `scrollIntoView` also moves the page, so the thumb lies. */
    scrollHighlightIntoView() {
      const list = this.$refs.suggestionList;
      const item = list?.children?.[this.highlight];
      if (!list || !item || this.highlight < 0) return;
      const listRect = list.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      if (itemRect.top < listRect.top) {
        list.scrollTop -= listRect.top - itemRect.top;
      } else if (itemRect.bottom > listRect.bottom) {
        list.scrollTop += itemRect.bottom - listRect.bottom;
      }
    },
    /** Enter takes the keyboard item, or the hovered one if arrows have not been used. */
    onEnter() {
      const index = this.highlight >= 0 ? this.highlight : this.hoverIndex;
      const suggestion = index >= 0 ? this.suggestions[index] : null;
      if (this.suggestionsOpen && suggestion) {
        this.pickSuggestion(suggestion);
        return;
      }
      this.commitDraft();
    },
    pickSuggestion(suggestion) {
      if (suggestion.type === "key") {
        this.pending = {key: suggestion.value, operator: null};
        this.draft = "";
        const operators = operatorsFor(this.schema, suggestion.value);
        if (operators.length === 1) {
          this.pending.operator = operators[0];
          this.stage = "value";
        } else {
          this.stage = "operator";
        }
      } else if (suggestion.type === "operator") {
        this.pending.operator = suggestion.value;
        this.stage = "value";
      } else {
        this.commitPending(suggestion.value);
      }
      this.highlight = -1;
      this.hoverIndex = -1;
      this.suggestionsOpen = true;
      this.focusDraft("end");
    },
    /** Enter with no highlight: finish the pending token, or parse what was typed. */
    commitDraft() {
      if (this.pending.key && this.stage === "operator") {
        this.tryResolvePendingOperator(true);
        return;
      }
      if (this.pending.key) {
        const value = coerceValue(this.schema, this.pending.key, unquote(this.draft.trim()));
        if (value !== null) {
          this.commitPending(value);
          return;
        }
        if (this.draft.trim()) {
          this.abandonPendingToDraft();
          return;
        }
        // Operator picked but no usable value yet — keep waiting instead of dropping the filter.
        if (needsTypedValue(this.schema, this.pending.key) && this.stage === "value") {
          return;
        }
      }
      this.absorbTokens();
      this.closeSuggestions();
      this.emitUpdate();
    },
    commitPending(value) {
      this.addToken({
        key: this.pending.key,
        operator: this.pending.operator || defaultOperator(this.schema, this.pending.key),
        value,
      });
      // Clear the typed value while pending is still set so it never lands in `search`.
      this.draft = "";
      this.resetPending();
    },
    onBackspace() {
      if (this.draft !== "") return;
      // Outside a raw zone there is nothing to edit character by character — drop the whole filter.
      if (this.pending.key) {
        this.resetPending();
      } else if (this.tokens.length > 0) {
        this.removeTokenAt(this.tokens.length - 1);
      }
    },
    onDraftLeft(event) {
      const el = event.target;
      if (el.selectionStart !== 0 || el.selectionEnd !== 0) return;
      if (this.pending.key) {
        event.preventDefault();
        this.collapsePendingToDraft();
        return;
      }
      if (this.tokens.length === 0) return;
      event.preventDefault();
      this.focusGap(this.tokens.length - 1);
    },
    onDraftRight(event) {
      if (this.pending.key) return;
      const el = event.target;
      if (el.selectionStart !== el.selectionEnd) return;
      const first = (this.draft.trimStart().match(/^\S+/) || [])[0];
      if (!first) return;
      const wordEnd = this.draft.length - this.draft.trimStart().length + first.length;
      const pos = el.selectionStart;
      // Revive on the Right that reaches the end of a recognized key, not one press later.
      if (pos < wordEnd - 1 || pos > wordEnd) return;
      if (!this.revivePendingFromDraft()) return;
      event.preventDefault();
    },
    /** Incomplete filter chip → plain text (key or `key:operator`). Caret stays at the end of that word. */
    collapsePendingToDraft() {
      this.writePendingIntoDraft("key");
    },
    /** Typed text is not a filter value/operator — drop the chip and keep everything as search text. */
    abandonPendingToDraft() {
      this.writePendingIntoDraft("end");
    },
    writePendingIntoDraft(caret) {
      const key = this.pending.key;
      const text = this.pending.operator
        ? `${key}:${this.pending.operator}`
        : keyLabel(this.schema, key);
      const leftover = this.draft.trim();
      this.skipDraftPromote = true;
      this.resetPending();
      this.draft = leftover ? `${text} ${leftover}` : text;
      this.suggestionsOpen = true;
      this.$nextTick(() => {
        this.skipDraftPromote = false;
        const el = this.$refs.input;
        if (el) {
          el.focus();
          const pos = caret === "key" ? text.length : el.value.length;
          el.setSelectionRange(pos, pos);
        }
      });
    },
    /**
     * Space (or another word) after a typed value: commit a valid number, otherwise fall back to
     * plain search text so a leftover word cannot become a filter.
     */
    tryFinishPendingValue() {
      if (!this.pending.key || this.stage !== "value") return false;
      const match = this.draft.match(/^(\S+)(\s+)([\s\S]*)$/);
      if (!match) return false;
      const word = unquote(match[1]);
      const rest = match[3].trimStart();
      const coerced = coerceValue(this.schema, this.pending.key, word);
      if (coerced !== null) {
        this.commitPending(coerced);
        if (rest) this.draft = rest;
        return true;
      }
      if (word) {
        this.abandonPendingToDraft();
        return true;
      }
      return false;
    },
    /**
     * After a key is picked, typing an operator (`=`, `>=`) selects it; any other text drops the
     * chip so the query stays ordinary search.
     * @param {boolean} commit Enter: accept a complete operator even if a longer one also matches.
     */
    tryResolvePendingOperator(commit = false) {
      if (!this.pending.key || this.stage !== "operator") return false;
      const typed = this.draft.trim();
      if (!typed) return false;
      const ops = operatorsFor(this.schema, this.pending.key);
      const prefixes = ops.filter((operator) => operator.startsWith(typed));
      const uniqueExact = prefixes.length === 1 && prefixes[0] === typed;
      if (ops.includes(typed) && (commit || uniqueExact)) {
        this.pending.operator = typed;
        this.stage = "value";
        this.draft = "";
        this.highlight = -1;
        this.hoverIndex = -1;
        this.suggestionsOpen = true;
        return true;
      }
      if (prefixes.length > 0) return false;
      this.abandonPendingToDraft();
      return true;
    },
    /**
     * Typed `key:operator` (sessions:=) opens the pending filter; a complete `key:operator value`
     * (sessions:=4) becomes a chip. A bare word (sessions) stays ordinary search text.
     */
    tryPromoteDraftKey() {
      if (this.pending.key || this.skipDraftPromote) return;
      const trimmed = this.draft.trim();
      if (!trimmed) return;
      const first = (trimmed.match(/^\S+/) || [])[0];
      if (!first) return;
      const complete = parseToken(this.schema, first);
      if (complete) {
        this.addToken(complete);
        this.draft = trimmed.slice(first.length).trimStart();
        return;
      }
      const tokenMatch = /^([A-Za-z_][A-Za-z0-9_]*):(!=|>=|<=|~|=|>|<)$/.exec(first);
      if (tokenMatch && this.schema[tokenMatch[1]]) {
        this.revivePendingFromDraft();
      }
    },
    /** `key:operator` at the caret (`sessions:=`) → pending chip waiting for a value. */
    revivePendingFromDraft() {
      const trimmed = this.draft.trimStart();
      if (!trimmed) return false;
      const first = (trimmed.match(/^\S+/) || [])[0];
      const tokenMatch = /^([A-Za-z_][A-Za-z0-9_]*):(!=|>=|<=|~|=|>|<)$/.exec(first);
      if (!tokenMatch || !this.schema[tokenMatch[1]]) return false;
      const key = tokenMatch[1];
      const operator = tokenMatch[2];
      const ops = operatorsFor(this.schema, key);
      if (!ops.includes(operator)) return false;
      this.pending = {key, operator};
      this.stage = "value";
      this.draft = trimmed.slice(first.length).trimStart();
      this.suggestionsOpen = true;
      this.highlight = -1;
      this.hoverIndex = -1;
      return true;
    },
    onGapKeydown(index, event) {
      if (event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        this.expandToken(index, "end");
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        const next = index + 1;
        if (next < this.tokens.length) {
          this.expandToken(next, "start");
        } else {
          this.focusDraft("start");
        }
        return;
      }
      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        this.removeFromGap(index);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        this.focusDraft("end");
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        this.focusDraft("end");
        return;
      }
      this.typeFromGap(event);
    },
    /** Backspace in a gap drops the filter to the left, caret stays between the neighbours. */
    removeFromGap(index) {
      this.movingFocus = true;
      this.removeTokenAt(index);
      if (this.tokens.length === 0) {
        this.focusDraft("start");
        return;
      }
      if (index === 0) {
        this.focusGap(-1);
        return;
      }
      this.focusGap(index - 1);
    },
    onLeadingGapKeydown(event) {
      if (event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        this.expandToken(0, "start");
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        return;
      }
      if (event.key === "Escape" || event.key === "Enter") {
        event.preventDefault();
        this.focusDraft("end");
        return;
      }
      this.typeFromGap(event);
    },
    onRawKeydown(event, index) {
      if (event.key === "ArrowLeft") {
        this.onRawLeft(event, index);
        return;
      }
      if (event.key === "ArrowRight") {
        this.onRawRight(event, index);
      }
    },
    typeFromGap(event) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.length !== 1) return;
      event.preventDefault();
      const ch = event.key;
      this.draft = `${ch}${this.draft}`;
      this.movingFocus = true;
      this.$nextTick(() => {
        const el = this.$refs.input;
        if (el) {
          el.focus();
          el.setSelectionRange(ch.length, ch.length);
        }
        this.movingFocus = false;
        this.suggestionsOpen = true;
      });
    },
    onGapPaste(event) {
      const text = event.clipboardData?.getData("text") || "";
      if (!text) return;
      this.draft = `${text}${this.draft}`;
      this.movingFocus = true;
      this.$nextTick(() => {
        const el = this.$refs.input;
        if (el) {
          el.focus();
          el.setSelectionRange(text.length, text.length);
        }
        this.movingFocus = false;
        this.absorbTokens();
        this.suggestionsOpen = true;
        this.emitUpdate();
      });
    },
    /** Open a committed filter for raw editing and put the caret at the entering edge. */
    expandToken(index, caret = "end") {
      const uid = this.tokens[index]?.uid;
      if (this.editIndex !== null && this.editIndex !== index) {
        this.movingFocus = true;
        this.commitRaw(false);
      }
      const target = this.tokens.findIndex((token) => token.uid === uid);
      if (target === -1) {
        this.movingFocus = false;
        return;
      }
      this.resetPending();
      this.closeSuggestions();
      this.movingFocus = true;
      this.editIndex = target;
      this.editText = serializeToken(this.schema, this.tokens[target]);
      this.$nextTick(() => {
        const el = this.rawInput();
        if (el) {
          el.focus();
          if (caret === "all") {
            el.select();
          } else {
            const position = caret === "start" ? 0 : el.value.length;
            el.setSelectionRange(position, position);
          }
        }
        this.movingFocus = false;
      });
    },
    onRawLeft(event, index) {
      const el = event.target;
      if (el.selectionStart !== 0 || el.selectionEnd !== 0) return;
      event.preventDefault();
      if (index === 0) return;
      this.movingFocus = true;
      this.commitRaw(false);
      this.focusGap(index - 1);
    },
    onRawRight(event, index) {
      const el = event.target;
      if (el.selectionStart !== el.value.length || el.selectionEnd !== el.value.length) return;
      event.preventDefault();
      this.movingFocus = true;
      const result = this.commitRaw(false);
      if (result === "plain") {
        this.focusDraft("end");
        return;
      }
      if (result === "removed") {
        if (this.tokens.length === 0) {
          this.focusDraft("start");
          return;
        }
        if (index === 0) {
          this.focusGap(-1);
          return;
        }
        this.focusGap(index - 1);
        return;
      }
      this.focusGap(index);
    },
    onRawBlur() {
      if (this.movingFocus) return;
      this.commitRaw(false);
    },
    /**
     * Leave the raw zone: keep the filter if the text still parses, drop it when emptied, and fall
     * back to plain search text when the key or operator no longer makes a token.
     * @returns {string} "kept" | "removed" | "plain" | "none"
     */
    commitRaw(refocusDraft = false) {
      if (this.editIndex === null) return "none";
      const index = this.editIndex;
      const token = this.tokens[index];
      const text = this.editText.trim();
      this.editIndex = null;
      this.editText = "";
      if (!token) return "none";

      let result = "kept";
      if (!text) {
        this.tokens.splice(index, 1);
        result = "removed";
      } else {
        const parsed = parseToken(this.schema, text);
        if (parsed) {
          this.tokens.splice(index, 1, {...parsed, uid: token.uid});
          this.dedupeKey(index);
        } else {
          // Incomplete/invalid raw (`state:=` after deleting the value) stays as plain search
          // text — do not auto-promote back into a chip.
          this.skipDraftPromote = true;
          this.tokens.splice(index, 1);
          this.draft = this.draft ? `${text} ${this.draft}` : text;
          result = "plain";
          this.$nextTick(() => {
            this.skipDraftPromote = false;
          });
        }
      }
      this.emitUpdate();
      if (refocusDraft) {
        this.movingFocus = true;
        this.focusDraft("end");
      }
      return result;
    },
    onPaste(event) {
      const text = event.clipboardData?.getData("text") || "";
      this.draft = this.draft ? `${this.draft} ${text}` : text;
      this.absorbTokens();
      this.emitUpdate();
    },
    /** Pull every complete token out of the draft and leave the rest as free text. */
    absorbTokens() {
      const {tokens, text} = parseQuery(this.schema, this.draft);
      if (tokens.length === 0) return;
      tokens.forEach((token) => this.addToken(token));
      this.draft = text.length > 0 ? `${text.join(" ")} ` : "";
    },
    /** One token per key in this version — a second pick replaces the first. */
    addToken(token) {
      const index = this.tokens.findIndex((existing) => existing.key === token.key);
      if (index === -1) {
        this.tokens.push({...token, uid: this.nextUid()});
      } else {
        this.tokens.splice(index, 1, {...token, uid: this.tokens[index].uid});
      }
      this.emitUpdate();
    },
    dedupeKey(keepIndex) {
      const key = this.tokens[keepIndex]?.key;
      if (!key) return;
      this.tokens = this.tokens.filter((token, index) => index === keepIndex || token.key !== key);
    },
    removeTokenAt(index) {
      this.tokens.splice(index, 1);
      if (this.editIndex === index) {
        this.editIndex = null;
        this.editText = "";
      } else if (this.editIndex > index) {
        this.editIndex -= 1;
      }
      this.emitUpdate();
    },
    resetPending() {
      this.pending = {key: null, operator: null};
      this.stage = "key";
      this.highlight = -1;
      this.hoverIndex = -1;
    },
    clearAll() {
      this.tokens = [];
      this.editIndex = null;
      this.editText = "";
      this.resetPending();
      this.draft = "";
      this.closeSuggestions();
      this.emitUpdate();
    },
    async copyQuery() {
      const text = this.queryString;
      if (!text) return;
      let ok = false;
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch (_error) {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      }
      this.copied = ok;
      clearTimeout(this.copiedTimer);
      if (ok) {
        this.copiedTimer = setTimeout(() => {
          this.copied = false;
        }, 2000);
      }
    },
    hydrate(value) {
      const tokens = [];
      Object.entries(value?.columnFilters || {}).forEach(([key, filter]) => {
        if (!this.schema[key] || !filter) return;
        const operator = filter.operator || defaultOperator(this.schema, key);
        if (!operatorsFor(this.schema, key).includes(operator)) return;
        tokens.push({key, operator, value: filter.value, uid: this.nextUid()});
      });
      this.tokens = tokens;
      this.draft = value?.search || "";
      this.editIndex = null;
      this.editText = "";
      this.resetPending();
    },
    emitUpdate() {
      this.$emit("update:modelValue", this.payload);
    },
  },
};
</script>

<style scoped>
.table-search {
  position: relative;
}

.table-search > .search-bar-btn {
  flex-shrink: 0;
}

.token-field {
  --token-chip-gap: 0.2rem;
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  height: auto;
  min-height: calc(1.5em + 0.5rem + 2px);
  cursor: text;
  column-gap: 0;
  row-gap: 0.25rem;
  overflow: visible;
}

.token-chip,
.token-raw {
  margin-inline-end: var(--token-chip-gap);
}

.token-chip {
  background-color: var(--bs-secondary-bg, #e9ecef);
  border: 1px solid var(--bs-border-color, #dee2e6);
  color: var(--bs-body-color, #212529);
  font-weight: 400;
  cursor: pointer;
}

.token-chip-pending {
  border-style: dashed;
}

.token-gap {
  display: inline-block;
  flex: 0 0 0;
  width: 0;
  overflow: visible;
  align-self: stretch;
  position: relative;
  outline: none;
  cursor: text;
}

.token-gap:focus {
  outline: none;
}

.token-gap:focus::before {
  content: "";
  position: absolute;
  left: calc(var(--token-chip-gap) / -2);
  top: 0.2em;
  width: 1px;
  height: 1em;
  background: currentColor;
  animation: token-caret 1s step-end infinite;
}

@keyframes token-caret {
  50% { opacity: 0; }
}

.token-raw {
  min-width: 3ch;
  padding: 0 0.25rem;
  border: 1px solid var(--bs-primary, #0d6efd);
  border-radius: 0.25rem;
  background: transparent;
  font-family: var(--bs-font-monospace, monospace);
  outline: none;
}

.token-compose {
  flex: 1 1 8rem;
  min-width: 8rem;
  display: flex;
  align-items: center;
  align-self: stretch;
}

.token-input {
  flex: 1 1 auto;
  min-width: 0;
  width: 100%;
  border: 0;
  padding: 0;
  background: transparent;
  outline: none;
}

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

/* Cursor: outline. Arrows: sidebar fill. Same item with both: combine. */
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

.token-suggestions-date {
  max-height: none;
  overflow: hidden;
  padding: 0;
}

.token-date-picker {
  width: 17.5rem;
  padding: 0.5rem 0.6rem 0.65rem;
}

.token-date-picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
}

.token-date-picker-title {
  font-weight: 600;
  font-size: 0.85rem;
}

.token-date-picker-titles {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  flex: 1;
  min-width: 0;
}

.token-date-title-btn {
  border: 0;
  border-radius: 0.25rem;
  background: transparent;
  color: inherit;
  font-weight: 600;
  font-size: 0.85rem;
  padding: 0.15rem 0.35rem;
}

.token-date-title-btn:hover {
  background-color: #e0e0e0;
}

.token-date-nav {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  padding: 0;
  border: 0;
  border-radius: 0.25rem;
  background: transparent;
  color: inherit;
}

.token-date-nav:hover:not(:disabled) {
  background-color: #e0e0e0;
}

.token-date-nav:disabled {
  opacity: 0.35;
}

.token-date-picker-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.1rem;
  text-align: center;
}

.token-date-picker-dow {
  font-size: 0.7rem;
  color: var(--bs-secondary-color, #6c757d);
  padding: 0.2rem 0;
}

.token-date-picker-day {
  border: 0;
  border-radius: 0.25rem;
  background: transparent;
  color: inherit;
  padding: 0.3rem 0;
  line-height: 1;
}

.token-date-picker-day.muted {
  color: var(--bs-secondary-color, #6c757d);
}

.token-date-picker-day.is-today {
  font-weight: 600;
}

.token-date-picker-day:hover:not(:disabled) {
  box-shadow: inset 0 0 0 2px #222;
}

.token-date-picker-day.is-selected {
  background-color: #e0e0e0;
  box-shadow: inset 2px 0 0 #222;
}

.token-date-picker-day.is-selected:hover {
  box-shadow: inset 2px 0 0 #222, inset 0 0 0 2px #222;
}

.token-date-picker-day:disabled,
.token-date-picker-cell:disabled {
  opacity: 0.35;
  cursor: default;
  box-shadow: none;
}

.token-date-picker-day:disabled:hover,
.token-date-picker-cell:disabled:hover {
  box-shadow: none;
}

.token-date-picker-grid-months,
.token-date-picker-grid-years {
  grid-template-columns: repeat(3, 1fr);
  gap: 0.25rem;
  min-height: 11.5rem;
  align-content: stretch;
}

.token-date-picker-cell {
  border: 0;
  border-radius: 0.25rem;
  background: transparent;
  color: inherit;
  padding: 0.55rem 0;
  font-size: 0.85rem;
}

.token-date-picker-cell:hover:not(:disabled) {
  box-shadow: inset 0 0 0 2px #222;
}

.token-date-picker-cell.is-selected {
  background-color: #e0e0e0;
}

.token-date-picker-cell.is-selected:hover:not(:disabled) {
  box-shadow: inset 0 0 0 2px #222;
}
</style>
