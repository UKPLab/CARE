<template>
  <div class="care-cal">
    <!-- Main view; the quick-time editor and the zone list replace it in place -->
    <template v-if="view === 'calendar'">
    <div class="care-cal__head">
      <BasicButton
        class="btn-icon care-cal__nav"
        :title="prevLabel"
        :aria-label="prevLabel"
        @click="shiftView(-1)"
      >
        <LoadIcon icon-name="chevron-left" :size="12" />
      </BasicButton>
      <div class="care-cal__title" aria-live="polite">
        <template v-if="mode === 'days'">
          <button
            type="button"
            class="care-cal__title-btn"
            :title="$t('common.datePicker.selectMonth')"
            @click="openMode('months')"
          >
            {{ monthName }}
          </button>
          <button
            type="button"
            class="care-cal__title-btn"
            :title="$t('common.datePicker.selectYear')"
            @click="openMode('years')"
          >
            {{ viewYear }}
          </button>
        </template>
        <button
          v-else-if="mode === 'months'"
          type="button"
          class="care-cal__title-btn"
          :title="$t('common.datePicker.selectYear')"
          @click="openMode('years')"
        >
          {{ viewYear }}
        </button>
        <span v-else class="care-cal__title-range">{{ yearPageStart }} – {{ yearPageStart + 11 }}</span>
      </div>
      <BasicButton
        class="btn-icon care-cal__nav"
        :title="nextLabel"
        :aria-label="nextLabel"
        @click="shiftView(1)"
      >
        <LoadIcon icon-name="chevron-right" :size="12" />
      </BasicButton>
    </div>

    <div
      v-if="mode === 'months'"
      ref="pickGrid"
      class="care-cal__pick"
      role="group"
      :aria-label="String(viewYear)"
    >
      <button
        v-for="item in monthItems"
        :key="item.index"
        type="button"
        class="care-cal__pick-item"
        :class="{ 'is-current': item.current, 'is-selected': item.selected }"
        :disabled="item.disabled"
        @click="pickMonth(item.index)"
      >
        {{ item.label }}
      </button>
    </div>

    <div
      v-else-if="mode === 'years'"
      ref="pickGrid"
      class="care-cal__pick"
      role="group"
    >
      <button
        v-for="item in yearItems"
        :key="item.year"
        type="button"
        class="care-cal__pick-item"
        :class="{ 'is-current': item.current, 'is-selected': item.selected }"
        :disabled="item.disabled"
        @click="pickYear(item.year)"
      >
        {{ item.year }}
      </button>
    </div>

    <div
      v-if="mode === 'days'"
      class="care-cal__weekdays"
      aria-hidden="true"
    >
      <span v-for="weekday in weekdays" :key="weekday">{{ weekday }}</span>
    </div>

    <div
      v-if="mode === 'days'"
      ref="grid"
      class="care-cal__grid"
      role="grid"
      :aria-label="monthLabel"
      @keydown="onGridKeydown"
    >
      <button
        v-for="cell in cells"
        :key="cell.ymd"
        type="button"
        class="care-cal__day"
        :class="{
          'is-outside': cell.outside,
          'is-today': cell.today,
          'is-selected': cell.selected,
        }"
        :data-ymd="cell.ymd"
        :tabindex="cell.ymd === tabbableYmd ? 0 : -1"
        :disabled="cell.disabled"
        :aria-label="cell.label"
        :aria-pressed="cell.selected ? 'true' : 'false'"
        @click="$emit('select', cell.ymd)"
      >
        {{ cell.day }}
      </button>
    </div>

    <div
      v-if="showTime"
      class="care-cal__time"
      :class="{ 'is-disabled': !selected }"
    >
      <LoadIcon class="care-cal__time-icon" icon-name="clock" :size="15" />
      <div class="care-cal__time-fields" role="group" :aria-label="$t('common.datePicker.time')">
        <input
          v-model="hourText"
          class="care-cal__time-input"
          type="text"
          inputmode="numeric"
          maxlength="2"
          autocomplete="off"
          :disabled="!selected"
          :aria-label="$t('common.datePicker.hour')"
          @keydown.up.prevent="stepTime(1, 0)"
          @keydown.down.prevent="stepTime(-1, 0)"
          @focus="$event.target.select()"
          @change="commitTime"
          @blur="commitTime"
        >
        <span class="care-cal__time-sep" aria-hidden="true">:</span>
        <input
          v-model="minuteText"
          class="care-cal__time-input"
          type="text"
          inputmode="numeric"
          maxlength="2"
          autocomplete="off"
          :disabled="!selected"
          :aria-label="$t('common.datePicker.minute')"
          @keydown.up.prevent="stepTime(0, 5)"
          @keydown.down.prevent="stepTime(0, -5)"
          @focus="$event.target.select()"
          @change="commitTime"
          @blur="commitTime"
        >
      </div>
      <div class="care-cal__chips">
        <button
          v-for="preset in presets"
          :key="preset"
          type="button"
          class="care-cal__chip"
          :class="{ 'is-active': preset === time }"
          :disabled="!selected"
          @click="$emit('update:time', preset)"
        >
          {{ preset }}
        </button>
        <button
          ref="editPresets"
          type="button"
          class="care-cal__chip care-cal__chip--edit"
          :title="$t('common.datePicker.presets.edit')"
          :aria-label="$t('common.datePicker.presets.edit')"
          @click="openView('presets')"
        >
          <LoadIcon icon-name="pencil" :size="11" />
        </button>
      </div>
    </div>

    <div v-if="showTime && zone" class="care-cal__zone-wrap">
      <button
        ref="zoneButton"
        type="button"
        class="care-cal__zone"
        :class="{ 'is-custom': !zone.isDevice }"
        :title="$t('common.datePicker.zones.change')"
        :aria-label="`${$t('common.datePicker.zones.change')}: ${[zone.name, zone.label, zone.offset].filter(Boolean).join(', ')}`"
        @click="openView('zones')"
      >
        <LoadIcon class="care-cal__zone-icon" icon-name="globe2" :size="15" />
        <span class="care-cal__zone-text">
          <span class="care-cal__zone-name">{{ zone.name || zone.label }}</span>
          <span class="care-cal__zone-meta">
            {{ [
              zone.name ? zone.label : '',
              zone.observesDst ? (zone.isDst ? $t('common.datePicker.summerTime') : $t('common.datePicker.winterTime')) : '',
              zone.isDevice ? '' : $t('common.datePicker.zones.custom'),
            ].filter(Boolean).join(' · ') }}
          </span>
        </span>
        <span
          class="care-cal__zone-offset"
          :class="{ 'is-summer': zone.observesDst && zone.isDst, 'is-winter': zone.observesDst && !zone.isDst }"
        >
          <LoadIcon
            v-if="zone.observesDst"
            class="care-cal__season-icon"
            :icon-name="zone.isDst ? 'sun' : 'snow'"
            :size="11"
          />
          {{ zone.offset }}
          <LoadIcon class="care-cal__zone-caret" icon-name="chevron-expand" :size="10" />
        </span>
      </button>

      <div
        v-if="zone.notice"
        class="care-cal__zone-note"
        role="status"
      >
        <LoadIcon class="care-cal__zone-note-icon" icon-name="arrow-repeat" :size="11" />
        <span>{{ zone.notice }}</span>
      </div>
    </div>

    <div v-if="showToday || $slots.footer" class="care-cal__foot">
      <button
        v-if="showToday"
        type="button"
        class="care-cal__link"
        :disabled="todayDisabled"
        @click="goToday"
      >
        {{ $t('common.datePicker.today') }}
      </button>
      <slot name="footer" />
    </div>
    </template>

    <TimePresetsEditor
      v-else-if="view === 'presets'"
      :model-value="presets"
      @update:model-value="$emit('update:presets', $event)"
      @back="closeView('editPresets')"
    />

    <TimeZoneSelect
      v-else-if="view === 'zones' && zone"
      :model-value="zone.isDevice ? null : zone.id"
      :at="zone.at"
      @update:model-value="$emit('update:zone', $event)"
      @back="closeView('zoneButton')"
    />
  </div>
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";
import BasicButton from "@/basic/Button.vue";
import TimePresetsEditor from "@/basic/form/TimePresetsEditor.vue";
import TimeZoneSelect from "@/basic/form/TimeZoneSelect.vue";
import {DEFAULT_TIME_PRESETS} from "@/basic/form/datetimePrefs";
import {zonedParts} from "@/basic/form/timeZone";

/**
 * Month calendar (Monday first) with an optional time row. Used by DatetimePicker, either inline
 * (table search) or inside a popup (forms). It only edits two plain strings and holds no value:
 * `selected` is "YYYY-MM-DD", `time` is "HH:MM" (wall clock in `zone`).
 *
 * The pencil after the quick times opens their editor, the zone row opens the zone list. Both
 * replace the calendar in place and only emit; the parent stores the result.
 */
const pad = (n) => String(n).padStart(2, "0");
const toYmd = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const fromYmd = (ymd) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export default {
  name: "CalendarPanel",
  components: {LoadIcon, BasicButton, TimePresetsEditor, TimeZoneSelect},
  props: {
    /** Selected day "YYYY-MM-DD" or null. */
    selected: {type: String, required: false, default: null},
    /** Selected time "HH:MM" or null. */
    time: {type: String, required: false, default: null},
    showTime: {type: Boolean, required: false, default: false},
    /**
     * Time zone shown under the time row:
     * {id, label, name, offset, observesDst, isDst, isDevice, at, notice}.
     * Computed by DatetimePicker for the selected day, so the offset follows summer/winter time.
     */
    zone: {type: Object, required: false, default: null},
    /** Quick-time buttons "HH:MM" in display order. */
    presets: {type: Array, required: false, default: () => [...DEFAULT_TIME_PRESETS]},
    /** "Today" shortcut in the footer. */
    showToday: {type: Boolean, required: false, default: true},
    /** Earliest / latest selectable day "YYYY-MM-DD". */
    min: {type: String, required: false, default: null},
    max: {type: String, required: false, default: null},
    locale: {type: String, required: false, default: undefined},
  },
  emits: ["select", "update:time", "update:presets", "update:zone"],
  data() {
    const base = this.selected ? fromYmd(this.selected) : new Date();
    return {
      viewYear: base.getFullYear(),
      viewMonth: base.getMonth(),
      mode: "days", // "days" | "months" | "years"
      yearPageStart: base.getFullYear() - 4,
      hourText: "",
      minuteText: "",
      view: "calendar", // "calendar" | "presets" | "zones"
    };
  },
  computed: {
    /** Today in the shown zone (it can already be tomorrow in Tokyo). */
    todayYmd() {
      if (this.zone?.id) {
        try {
          return zonedParts(this.zone.id, Date.now()).ymd;
        } catch {
          // fall through to the device date
        }
      }
      return toYmd(new Date());
    },
    monthLabel() {
      return new Intl.DateTimeFormat(this.locale, {month: "long", year: "numeric"})
        .format(new Date(this.viewYear, this.viewMonth, 1));
    },
    monthName() {
      return new Intl.DateTimeFormat(this.locale, {month: "long"})
        .format(new Date(this.viewYear, this.viewMonth, 1));
    },
    prevLabel() {
      return this.mode === "days"
        ? this.$t("common.datePicker.previousMonth")
        : this.$t("common.datePicker.previousYear");
    },
    nextLabel() {
      return this.mode === "days"
        ? this.$t("common.datePicker.nextMonth")
        : this.$t("common.datePicker.nextYear");
    },
    monthItems() {
      const formatter = new Intl.DateTimeFormat(this.locale, {month: "short"});
      const selected = this.selected ? fromYmd(this.selected) : null;
      const now = new Date();
      return Array.from({length: 12}, (_, index) => {
        const first = toYmd(new Date(this.viewYear, index, 1));
        const last = toYmd(new Date(this.viewYear, index + 1, 0));
        return {
          index,
          label: formatter.format(new Date(this.viewYear, index, 1)),
          current: now.getFullYear() === this.viewYear && now.getMonth() === index,
          selected: !!selected && selected.getFullYear() === this.viewYear && selected.getMonth() === index,
          disabled: (!!this.min && last < this.min) || (!!this.max && first > this.max),
        };
      });
    },
    yearItems() {
      const selectedYear = this.selected ? fromYmd(this.selected).getFullYear() : null;
      const nowYear = new Date().getFullYear();
      const minYear = this.min ? Number(this.min.slice(0, 4)) : null;
      const maxYear = this.max ? Number(this.max.slice(0, 4)) : null;
      return Array.from({length: 12}, (_, i) => {
        const year = this.yearPageStart + i;
        return {
          year,
          current: year === nowYear,
          selected: year === selectedYear,
          disabled: (minYear !== null && year < minYear) || (maxYear !== null && year > maxYear),
        };
      });
    },
    weekdays() {
      const formatter = new Intl.DateTimeFormat(this.locale, {weekday: "short"});
      // 2024-01-01 is a Monday
      return Array.from({length: 7}, (_, i) => formatter.format(new Date(2024, 0, 1 + i)));
    },
    cells() {
      const fullDate = new Intl.DateTimeFormat(this.locale, {dateStyle: "full"});
      const first = new Date(this.viewYear, this.viewMonth, 1);
      const offset = (first.getDay() + 6) % 7; // Monday first
      return Array.from({length: 42}, (_, i) => {
        const date = new Date(this.viewYear, this.viewMonth, 1 - offset + i);
        const ymd = toYmd(date);
        return {
          ymd,
          day: date.getDate(),
          outside: date.getMonth() !== this.viewMonth,
          today: ymd === this.todayYmd,
          selected: ymd === this.selected,
          disabled: (!!this.min && ymd < this.min) || (!!this.max && ymd > this.max),
          label: fullDate.format(date),
        };
      });
    },
    /** The one day in the Tab order: selected, else today, else the 1st of the month. */
    tabbableYmd() {
      const visible = (ymd) => this.cells.some((c) => c.ymd === ymd && !c.outside && !c.disabled);
      if (this.selected && visible(this.selected)) return this.selected;
      if (visible(this.todayYmd)) return this.todayYmd;
      return this.cells.find((c) => !c.outside && !c.disabled)?.ymd ?? null;
    },
    todayDisabled() {
      return (!!this.min && this.todayYmd < this.min) || (!!this.max && this.todayYmd > this.max);
    },
  },
  watch: {
    selected(value) {
      if (!value) return;
      const date = fromYmd(value);
      this.viewYear = date.getFullYear();
      this.viewMonth = date.getMonth();
      this.mode = "days";
    },
    time: {
      immediate: true,
      handler(value) {
        const [h, m] = (value || "").split(":");
        this.hourText = h ?? "";
        this.minuteText = m ?? "";
      },
    },
  },
  methods: {
    openView(view) {
      this.view = view;
    },
    /** Back to the calendar, focus on the button that opened the sub-view. */
    closeView(focusRef) {
      this.view = "calendar";
      this.$nextTick(() => this.$refs[focusRef]?.focus({preventScroll: true}));
    },
    /** Arrows: one month in the day view, one year in the month view, a page of 12 in the year view. */
    shiftView(delta) {
      if (this.mode === "years") {
        this.yearPageStart += delta * 12;
      } else if (this.mode === "months") {
        this.viewYear += delta;
      } else {
        const date = new Date(this.viewYear, this.viewMonth + delta, 1);
        this.viewYear = date.getFullYear();
        this.viewMonth = date.getMonth();
      }
    },
    openMode(mode) {
      this.mode = mode;
      if (mode === "years") this.yearPageStart = this.viewYear - 4;
      this.focusPick();
    },
    pickMonth(index) {
      this.viewMonth = index;
      this.mode = "days";
      this.focusDay();
    },
    pickYear(year) {
      this.viewYear = year;
      this.mode = "days";
      this.focusDay();
    },
    focusPick() {
      this.$nextTick(() => {
        const grid = this.$refs.pickGrid;
        (grid?.querySelector(".is-selected:not(:disabled)")
          || grid?.querySelector(".is-current:not(:disabled)")
          || grid?.querySelector("button:not(:disabled)"))?.focus();
      });
    },
    focusDay() {
      this.$nextTick(() => {
        this.$refs.grid?.querySelector('.care-cal__day[tabindex="0"]')?.focus();
      });
    },
    goToday() {
      this.$emit("select", this.todayYmd);
    },
    /** Arrow keys move by day/week, Home/End jump to the week edges, PageUp/PageDown by month. */
    onGridKeydown(event) {
      const current = event.target?.dataset?.ymd;
      if (!current) return;
      const date = fromYmd(current);
      const moves = {
        ArrowLeft: () => date.setDate(date.getDate() - 1),
        ArrowRight: () => date.setDate(date.getDate() + 1),
        ArrowUp: () => date.setDate(date.getDate() - 7),
        ArrowDown: () => date.setDate(date.getDate() + 7),
        Home: () => date.setDate(date.getDate() - ((date.getDay() + 6) % 7)),
        End: () => date.setDate(date.getDate() + (6 - ((date.getDay() + 6) % 7))),
        PageUp: () => date.setMonth(date.getMonth() - 1),
        PageDown: () => date.setMonth(date.getMonth() + 1),
      };
      if (!moves[event.key]) return;
      event.preventDefault();
      moves[event.key]();
      this.viewYear = date.getFullYear();
      this.viewMonth = date.getMonth();
      const target = toYmd(date);
      this.$nextTick(() => {
        this.$refs.grid?.querySelector(`[data-ymd="${target}"]`)?.focus();
      });
    },
    /**
     * Write the hour and minute fields back onto the selected day.
     * @returns {void}
     */
    commitTime() {
      if (!this.selected) return;
      const hours = Math.min(23, Math.max(0, parseInt(this.hourText, 10) || 0));
      const minutes = Math.min(59, Math.max(0, parseInt(this.minuteText, 10) || 0));
      const value = `${pad(hours)}:${pad(minutes)}`;
      this.hourText = pad(hours);
      this.minuteText = pad(minutes);
      if (value !== this.time) this.$emit("update:time", value);
    },
    stepTime(hourDelta, minuteDelta) {
      if (!this.selected) return;
      const [h, m] = (this.time || "00:00").split(":").map(Number);
      let total = h * 60 + m + hourDelta * 60 + minuteDelta;
      total = ((total % 1440) + 1440) % 1440;
      this.$emit("update:time", `${pad(Math.floor(total / 60))}:${pad(total % 60)}`);
    },
  },
};
</script>

<style scoped>
.care-cal {
  width: 100%;
  user-select: none;
}

/* ---------- Header ---------- */
.care-cal__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .5rem;
  margin-bottom: .5rem;
}

.care-cal__title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: .15rem;
  flex: 1 1 auto;
  font-size: .95rem;
  font-weight: 600;
}

.care-cal__title-btn {
  padding: .2rem .5rem;
  font: inherit;
  color: inherit;
  text-transform: capitalize;
  background: transparent;
  border: 0;
  border-radius: var(--care-radius-sm);
  cursor: pointer;
  transition: background-color var(--care-dur-fast) var(--care-ease), color var(--care-dur-fast) var(--care-ease);
}

.care-cal__title-btn:hover {
  color: var(--care-primary);
  background: var(--bs-tertiary-bg);
}

.care-cal__title-btn:focus-visible {
  outline: none;
  box-shadow: var(--care-focus-ring);
}

.care-cal__title-range {
  padding: .2rem .5rem;
}

/* ---------- Month / year pickers ---------- */
.care-cal__pick {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-rows: repeat(4, 1fr);
  gap: 4px;
  /* About the height of the day grid so the popup does not jump */
  min-height: 15.5rem;
}

.care-cal__pick-item {
  padding: 0;
  font-size: .9rem;
  font-variant-numeric: tabular-nums;
  text-transform: capitalize;
  color: var(--bs-body-color);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--care-radius-md);
  cursor: pointer;
  transition: background-color var(--care-dur-fast) var(--care-ease), border-color var(--care-dur-fast) var(--care-ease);
}

.care-cal__pick-item:hover:not(:disabled):not(.is-selected) {
  background: var(--bs-tertiary-bg);
  border-color: var(--bs-border-color);
}

.care-cal__pick-item.is-current {
  font-weight: 700;
  color: var(--care-primary);
  border-color: var(--care-primary);
}

.care-cal__pick-item.is-selected {
  font-weight: 600;
  color: var(--care-on-primary);
  background: var(--care-primary);
  border-color: var(--care-primary);
}

.care-cal__pick-item:disabled {
  opacity: .3;
  cursor: not-allowed;
}

.care-cal__pick-item:focus-visible {
  outline: none;
  box-shadow: var(--care-focus-ring);
}

.care-cal__nav {
  border-radius: 50%;
}

/* ---------- Grid ---------- */
.care-cal__weekdays,
.care-cal__grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 2px;
}

.care-cal__weekdays span {
  padding: .25rem 0;
  text-align: center;
  font-size: .7rem;
  font-weight: 600;
  letter-spacing: .03em;
  text-transform: uppercase;
  color: var(--bs-secondary-color);
}

.care-cal__day {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  min-height: 32px;
  padding: 0;
  font-size: .85rem;
  font-variant-numeric: tabular-nums;
  color: var(--bs-body-color);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 50%;
  cursor: pointer;
  transition: background-color var(--care-dur-fast) var(--care-ease),
              border-color var(--care-dur-fast) var(--care-ease),
              transform var(--care-dur-fast) ease;
}

.care-cal__day:hover:not(:disabled):not(.is-selected) {
  background: var(--bs-tertiary-bg);
  border-color: var(--bs-border-color);
}

.care-cal__day.is-outside {
  color: var(--bs-tertiary-color);
  opacity: .55;
}

.care-cal__day.is-today {
  font-weight: 700;
  border-color: var(--care-primary);
  color: var(--care-primary);
}

.care-cal__day.is-selected {
  font-weight: 600;
  color: var(--care-on-primary);
  background: var(--care-primary);
  border-color: var(--care-primary);
  box-shadow: 0 2px 6px color-mix(in srgb, var(--care-primary) 45%, transparent);
}

.care-cal__day:disabled {
  opacity: .3;
  cursor: not-allowed;
}

.care-cal__day:focus-visible,
.care-cal__chip:focus-visible,
.care-cal__link:focus-visible {
  outline: none;
  box-shadow: var(--care-focus-ring);
}

/* ---------- Time ---------- */
.care-cal__time {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: .5rem .75rem;
  margin-top: .75rem;
  padding-top: .75rem;
  border-top: 1px solid var(--bs-border-color-translucent);
  transition: opacity 150ms ease;
}

.care-cal__time.is-disabled {
  opacity: .5;
}

.care-cal__time-icon {
  color: var(--bs-secondary-color);
}

.care-cal__time-fields {
  display: inline-flex;
  align-items: center;
  gap: .15rem;
  padding: 0 .35rem;
  background: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: var(--care-radius-md);
}

.care-cal__time-fields:focus-within {
  border-color: var(--care-primary);
  box-shadow: var(--care-focus-ring);
}

.care-cal__time-input {
  width: 2rem;
  padding: .3rem 0;
  text-align: center;
  font-size: .95rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--bs-body-color);
  background: transparent;
  border: 0;
  outline: none;
}

.care-cal__time-sep {
  font-weight: 600;
  color: var(--bs-secondary-color);
}

.care-cal__chips {
  display: flex;
  flex-wrap: wrap;
  gap: .25rem;
}

.care-cal__chip {
  padding: .15rem .5rem;
  font-size: .75rem;
  font-variant-numeric: tabular-nums;
  color: var(--bs-secondary-color);
  background: transparent;
  border: 1px solid var(--bs-border-color);
  border-radius: var(--care-radius-pill);
  cursor: pointer;
  transition: background-color var(--care-dur-fast) var(--care-ease), color var(--care-dur-fast) var(--care-ease);
}

.care-cal__chip:hover:not(:disabled) {
  color: var(--bs-body-color);
  background: var(--bs-tertiary-bg);
}

.care-cal__chip.is-active {
  color: var(--care-primary);
  border-color: var(--care-primary);
}

.care-cal__chip:disabled {
  cursor: not-allowed;
}

.care-cal__chip--edit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.9rem;
  padding: .15rem 0;
  border-style: dashed;
}

.care-cal__chip--edit:hover {
  color: var(--care-primary);
  border-color: var(--care-primary);
  border-style: solid;
}

/* ---------- Time zone ---------- */
.care-cal__zone-wrap {
  display: flex;
  flex-direction: column;
  gap: .4rem;
  margin-top: .6rem;
}

.care-cal__zone {
  display: flex;
  align-items: center;
  gap: .6rem;
  width: 100%;
  min-width: 0;
  padding: .45rem .6rem;
  font: inherit;
  text-align: left;
  color: inherit;
  background: var(--bs-tertiary-bg);
  border: 1px solid transparent;
  border-radius: var(--care-radius-md);
  cursor: pointer;
  transition: background-color var(--care-dur-fast) var(--care-ease), border-color var(--care-dur-fast) var(--care-ease);
}

.care-cal__zone:hover {
  border-color: var(--bs-border-color);
}

.care-cal__zone:hover .care-cal__zone-offset,
.care-cal__zone.is-custom .care-cal__zone-offset {
  color: var(--care-primary);
  border-color: var(--care-primary);
}

.care-cal__zone:focus-visible {
  outline: none;
  box-shadow: var(--care-focus-ring);
}

.care-cal__zone-caret {
  margin-left: -.1rem;
  opacity: .7;
}

.care-cal__zone-icon {
  flex: 0 0 auto;
  color: var(--bs-secondary-color);
}

.care-cal__zone-text {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
  line-height: 1.25;
}

.care-cal__zone-name,
.care-cal__zone-meta {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.care-cal__zone-name {
  font-size: .8rem;
  font-weight: 600;
  color: var(--bs-body-color);
}

.care-cal__zone-meta {
  font-size: .7rem;
  color: var(--bs-secondary-color);
}

.care-cal__zone-offset {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: .3rem;
  padding: .15rem .5rem;
  font-size: .75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  color: var(--bs-body-color);
  background: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: var(--care-radius-pill);
}

.care-cal__zone-offset.is-summer .care-cal__season-icon {
  color: #e8a10c;
}

.care-cal__zone-offset.is-winter .care-cal__season-icon {
  color: #3a8bd6;
}

.care-cal__zone-note {
  display: flex;
  align-items: flex-start;
  gap: .45rem;
  padding: .4rem .6rem;
  font-size: .75rem;
  line-height: 1.35;
  color: var(--bs-body-color);
  background: color-mix(in srgb, var(--bs-warning) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--bs-warning) 40%, transparent);
  border-radius: var(--care-radius-md);
}

.care-cal__zone-note-icon {
  flex: 0 0 auto;
  margin-top: .2rem;
  color: var(--bs-warning-text-emphasis);
}

/* ---------- Footer ---------- */
.care-cal__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .5rem;
  margin-top: .75rem;
}

.care-cal__link {
  padding: .25rem .6rem;
  font-size: .85rem;
  font-weight: 500;
  color: var(--care-primary);
  background: transparent;
  border: 0;
  border-radius: var(--care-radius-sm);
  cursor: pointer;
}

.care-cal__link:hover:not(:disabled) {
  background: color-mix(in srgb, var(--care-primary) 12%, transparent);
}

.care-cal__link:disabled {
  opacity: .4;
  cursor: not-allowed;
}

@media (prefers-reduced-motion: reduce) {
  .care-cal__title-btn,
  .care-cal__pick-item,
  .care-cal__day,
  .care-cal__chip,
  .care-cal__time,
  .care-cal__zone {
    transition: none;
  }
}
</style>
