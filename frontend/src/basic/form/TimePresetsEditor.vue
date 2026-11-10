<template>
  <div
    class="care-tp"
    @keydown.esc.stop.prevent="$emit('back')"
  >
    <div class="care-sub__head">
      <button
        ref="backButton"
        type="button"
        class="care-sub__back"
        :title="$t('common.back')"
        :aria-label="$t('common.back')"
        @click="$emit('back')"
      >
        <i class="bi bi-chevron-left" aria-hidden="true"></i>
      </button>
      <div class="care-sub__titles">
        <span class="care-sub__title">{{ $t('common.datePicker.presets.title') }}</span>
        <span class="care-sub__hint">{{ $t('common.datePicker.presets.hint') }}</span>
      </div>
      <button
        type="button"
        class="care-tp__sort"
        :disabled="isSorted"
        :title="$t('common.datePicker.presets.sort')"
        :aria-label="$t('common.datePicker.presets.sort')"
        @click="sortAscending"
      >
        <i class="bi bi-sort-numeric-down" aria-hidden="true"></i>
      </button>
    </div>

    <ul
      v-if="rows.length"
      class="care-tp__list"
      :class="{ 'is-sorting': drag }"
      :aria-label="$t('common.datePicker.presets.title')"
    >
      <li
        v-for="(row, index) in rows"
        :key="row.id"
        :ref="(el) => setRowRef(row.id, el)"
        class="care-tp__row"
        :class="{
          'is-dragging': drag && drag.id === row.id,
          'is-invalid': row.error,
        }"
        :style="rowStyle(index)"
        @keydown.alt.up.prevent="move(index, -1)"
        @keydown.alt.down.prevent="move(index, 1)"
      >
        <span
          class="care-tp__handle"
          :title="$t('common.datePicker.presets.drag')"
          aria-hidden="true"
          @pointerdown="onHandleDown(index, $event)"
          @pointermove="onHandleMove"
          @pointerup="onHandleUp"
          @pointercancel="onHandleCancel"
        >
          <i class="bi bi-grip-vertical"></i>
        </span>
        <span class="care-tp__pos" aria-hidden="true">{{ previewPosition(index) }}</span>
        <input
          :ref="(el) => setInputRef(row.id, el)"
          v-model="row.text"
          class="care-tp__input"
          type="text"
          inputmode="numeric"
          maxlength="5"
          autocomplete="off"
          placeholder="HH:MM"
          :aria-label="$t('common.datePicker.presets.timeLabel', {n: index + 1})"
          :aria-invalid="row.error ? 'true' : 'false'"
          @focus="$event.target.select()"
          @input="onInput(row)"
          @blur="onBlur(row)"
          @keydown.enter.prevent="$event.target.blur()"
        >
        <span v-if="row.error" class="care-tp__error">{{ row.error }}</span>
        <div class="care-tp__actions">
          <button
            type="button"
            class="care-tp__icon"
            :disabled="index === 0"
            :title="$t('common.datePicker.presets.moveUp')"
            :aria-label="$t('common.datePicker.presets.moveUp')"
            @click="move(index, -1)"
          >
            <i class="bi bi-chevron-up" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            class="care-tp__icon"
            :disabled="index === rows.length - 1"
            :title="$t('common.datePicker.presets.moveDown')"
            :aria-label="$t('common.datePicker.presets.moveDown')"
            @click="move(index, 1)"
          >
            <i class="bi bi-chevron-down" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            class="care-tp__icon is-danger"
            :title="$t('common.datePicker.presets.remove')"
            :aria-label="$t('common.datePicker.presets.remove')"
            @click="remove(index)"
          >
            <i class="bi bi-x-lg" aria-hidden="true"></i>
          </button>
        </div>
      </li>
    </ul>
    <p v-else class="care-tp__empty">{{ $t('common.datePicker.presets.empty') }}</p>

    <button
      v-if="rows.length < max"
      type="button"
      class="care-tp__add"
      @click="add"
    >
      <i class="bi bi-plus-lg" aria-hidden="true"></i>
      {{ $t('common.datePicker.presets.add') }}
    </button>

    <div class="care-sub__foot">
      <button
        type="button"
        class="care-sub__link"
        :disabled="isDefault"
        @click="reset"
      >
        <i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i>
        {{ $t('common.datePicker.presets.reset') }}
      </button>
      <button
        type="button"
        class="care-sub__done"
        @click="$emit('back')"
      >
        {{ $t('common.datePicker.done') }}
      </button>
    </div>
  </div>
</template>

<script>
import {DEFAULT_TIME_PRESETS, MAX_TIME_PRESETS} from "@/basic/form/datetimePrefs";

const pad = (n) => String(n).padStart(2, "0");
let nextId = 0;

/**
 * "9" -> "09:00", "930" -> "09:30", "14.5" -> null, "14h30" -> "14:30"
 * @returns {string|null} "HH:MM", or null if the text is not a time.
 */
function parseTime(text) {
  const match = String(text).trim().replace(/[.h]/gi, ":").match(/^(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  return hours < 24 && minutes < 60 ? `${pad(hours)}:${pad(minutes)}` : null;
}

/**
 * Edit, add, remove and reorder the quick-time buttons of the calendar. Reorder by dragging the
 * handle, with the arrow buttons, or with Alt+Up / Alt+Down. Every valid change is emitted at once.
 */
export default {
  name: "TimePresetsEditor",
  props: {
    /** Current quick times "HH:MM" in display order. */
    modelValue: {type: Array, required: true},
  },
  emits: ["update:modelValue", "back"],
  data() {
    return {
      rows: this.modelValue.map((text) => ({id: nextId++, text, error: ""})),
      max: MAX_TIME_PRESETS,
      drag: null, // {id, from, to, startY, dy, mids, step} while a row is dragged
      inputRefs: {},
      rowRefs: {},
    };
  },
  computed: {
    /** Already in ascending order (rows that are not a valid time count as last). */
    isSorted() {
      const keys = this.rows.map((row) => parseTime(row.text) ?? "99:99");
      return keys.every((key, i) => i === 0 || keys[i - 1] <= key);
    },
    isDefault() {
      const values = this.rows.map((row) => parseTime(row.text));
      return values.length === DEFAULT_TIME_PRESETS.length
        && values.every((value, i) => value === DEFAULT_TIME_PRESETS[i]);
    },
  },
  mounted() {
    this.$refs.backButton?.focus({preventScroll: true});
  },
  methods: {
    setRowRef(id, el) {
      if (el) this.rowRefs[id] = el;
      else delete this.rowRefs[id];
    },
    setInputRef(id, el) {
      if (el) this.inputRefs[id] = el;
      else delete this.inputRefs[id];
    },
    /** Mark bad or repeated times, then emit the valid ones in order. */
    sync() {
      const seen = new Set();
      for (const row of this.rows) {
        const value = parseTime(row.text);
        if (!value) {
          row.error = row.text.trim() ? this.$t("common.datePicker.presets.invalid") : "";
        } else if (seen.has(value)) {
          row.error = this.$t("common.datePicker.presets.duplicate");
        } else {
          row.error = "";
          seen.add(value);
        }
      }
      this.$emit("update:modelValue", [...seen]);
    },
    onInput(row) {
      this.sync();
      // No "invalid" while the user is still typing; shown on blur
      if (!parseTime(row.text)) row.error = "";
    },
    onBlur(row) {
      const value = parseTime(row.text);
      if (value) row.text = value;
      this.sync();
    },
    move(index, delta) {
      const target = index + delta;
      if (target < 0 || target >= this.rows.length) return;
      const [row] = this.rows.splice(index, 1);
      this.rows.splice(target, 0, row);
      this.sync();
      this.$nextTick(() => this.inputRefs[row.id]?.focus());
    },
    remove(index) {
      this.rows.splice(index, 1);
      this.sync();
      const next = this.rows[Math.min(index, this.rows.length - 1)];
      this.$nextTick(() => (next ? this.inputRefs[next.id] : this.$refs.backButton)?.focus());
    },
    add() {
      if (this.rows.length >= this.max) return;
      const used = new Set(this.rows.map((row) => parseTime(row.text)));
      let hour = 8;
      while (hour < 23 && used.has(`${pad(hour)}:00`)) hour++;
      const row = {id: nextId++, text: `${pad(hour)}:00`, error: ""};
      this.rows.push(row);
      this.sync();
      this.$nextTick(() => this.inputRefs[row.id]?.focus());
    },
    /** Earliest time first; rows that are not a valid time keep their order at the end. */
    sortAscending() {
      // Array.prototype.sort is stable, so equal keys keep their order
      this.rows = [...this.rows].sort((a, b) => {
        const ka = parseTime(a.text) ?? "99:99";
        const kb = parseTime(b.text) ?? "99:99";
        return ka < kb ? -1 : ka > kb ? 1 : 0;
      });
      this.sync();
    },
    reset() {
      this.rows = DEFAULT_TIME_PRESETS.map((text) => ({id: nextId++, text, error: ""}));
      this.sync();
    },
    /*
     * Drag to reorder (mouse, pen and touch via pointer events).
     * The list is NOT changed while dragging: the dragged row follows the pointer and the rows in
     * between slide aside with transforms. Row positions are measured once at the start, so moving
     * rows can never feed back into the calculation (which made rows flip back and forth before).
     * The order is changed once, on release.
     */
    onHandleDown(index, event) {
      if (event.button !== 0 || this.rows.length < 2) return;
      event.preventDefault();
      const els = this.rows.map((row) => this.rowRefs[row.id]);
      if (els.some((el) => !el)) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      const tops = els.map((el) => el.offsetTop);
      this.drag = {
        id: this.rows[index].id,
        from: index,
        to: index,
        startY: event.clientY,
        dy: 0,
        mids: els.map((el, i) => tops[i] + el.offsetHeight / 2),
        // Distance between two rows (height + gap)
        step: els.length > 1 ? tops[1] - tops[0] : els[0].offsetHeight,
      };
    },
    onHandleMove(event) {
      const drag = this.drag;
      if (!drag) return;
      const {mids, from} = drag;
      // Keep the row inside the list. The 1px past the first/last middle matters: the slot test
      // below is strict (<), so stopping exactly on the last row's middle never reached the last place.
      const minDy = mids[0] - mids[from] - 1;
      const maxDy = mids[mids.length - 1] - mids[from] + 1;
      const dy = Math.min(maxDy, Math.max(minDy, event.clientY - drag.startY));
      const center = mids[from] + dy;
      // Slot = number of other rows whose middle is above the dragged row's middle
      let to = 0;
      mids.forEach((mid, i) => {
        if (i !== from && mid < center) to++;
      });
      drag.dy = dy;
      drag.to = to;
    },
    onHandleUp() {
      const drag = this.drag;
      if (!drag) return;
      this.drag = null;
      if (drag.to === drag.from) return;
      const [row] = this.rows.splice(drag.from, 1);
      this.rows.splice(drag.to, 0, row);
      this.sync();
    },
    onHandleCancel() {
      this.drag = null;
    },
    /** 1-based position the row will have if released now (live while dragging). */
    previewPosition(index) {
      const drag = this.drag;
      if (!drag) return index + 1;
      if (index === drag.from) return drag.to + 1;
      if (drag.from < drag.to && index > drag.from && index <= drag.to) return index;
      if (drag.to < drag.from && index >= drag.to && index < drag.from) return index + 2;
      return index + 1;
    },
    /** Transform for a row while dragging; nothing otherwise. */
    rowStyle(index) {
      const drag = this.drag;
      if (!drag) return null;
      if (index === drag.from) return {transform: `translateY(${drag.dy}px)`};
      if (drag.from < drag.to && index > drag.from && index <= drag.to) {
        return {transform: `translateY(${-drag.step}px)`};
      }
      if (drag.to < drag.from && index >= drag.to && index < drag.from) {
        return {transform: `translateY(${drag.step}px)`};
      }
      return null;
    },
  },
};
</script>

<style scoped>
.care-tp__list {
  /* Rows' offsetTop is measured from the list (used by the drag logic) */
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0 0 .5rem;
  padding: 0;
  list-style: none;
}

.care-tp__row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: .4rem;
  padding: .25rem .35rem;
  background: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color-translucent);
  border-radius: var(--bs-border-radius, .5rem);
  transition: border-color var(--care-dur-fast, 120ms) ease,
              box-shadow var(--care-dur-fast, 120ms) ease,
              opacity var(--care-dur-fast, 120ms) ease;
}

.care-tp__row:hover,
.care-tp__row:focus-within {
  border-color: var(--bs-border-color);
}

.care-tp__sort {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  align-self: flex-start;
  width: 28px;
  height: 28px;
  margin-left: auto;
  padding: 0;
  font-size: .85rem;
  color: var(--bs-secondary-color);
  background: transparent;
  border: 1px solid var(--bs-border-color);
  border-radius: var(--bs-border-radius, .5rem);
  cursor: pointer;
  transition: color var(--care-dur-fast, 120ms) ease,
              border-color var(--care-dur-fast, 120ms) ease,
              background-color var(--care-dur-fast, 120ms) ease;
}

.care-tp__sort:hover:not(:disabled) {
  color: var(--care-primary, var(--bs-primary));
  border-color: var(--care-primary, var(--bs-primary));
  background: color-mix(in srgb, var(--care-primary, var(--bs-primary)) 8%, transparent);
}

.care-tp__sort:disabled {
  opacity: .35;
  cursor: default;
}

.care-tp__sort:focus-visible {
  outline: none;
  box-shadow: var(--care-focus-ring, 0 0 0 3px rgb(13 110 253 / .35));
}

/* While dragging, the other rows slide aside smoothly */
.care-tp__list.is-sorting {
  user-select: none;
  cursor: grabbing;
}

.care-tp__list.is-sorting .care-tp__row {
  transition: transform 160ms var(--care-ease, ease);
}

/* The dragged row is lifted and follows the pointer without delay */
.care-tp__list.is-sorting .care-tp__row.is-dragging {
  position: relative;
  z-index: 2;
  border-color: var(--care-primary, var(--bs-primary));
  box-shadow: var(--care-shadow-3, 0 8px 18px -6px rgb(0 0 0 / .25));
  transition: none;
}

.care-tp__row.is-invalid {
  border-color: var(--bs-danger, #dc3545);
}

.care-tp__handle {
  display: inline-flex;
  align-items: center;
  padding: .15rem 0;
  color: var(--bs-secondary-color);
  cursor: grab;
  /* Touch: the finger drags the row instead of scrolling the page */
  touch-action: none;
}

.care-tp__handle:hover {
  color: var(--bs-body-color);
}

.care-tp__row.is-dragging .care-tp__handle {
  cursor: grabbing;
}

.care-tp__pos {
  min-width: 1rem;
  font-size: .7rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: center;
  color: var(--bs-secondary-color);
  transition: color var(--care-dur-fast, 120ms) ease;
}

/* The dragged row's number shows where it will land */
.care-tp__row.is-dragging .care-tp__pos {
  color: var(--care-primary, var(--bs-primary));
}

.care-tp__input {
  width: 4.2rem;
  padding: .2rem .4rem;
  font-size: .9rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: center;
  color: var(--bs-body-color);
  background: var(--bs-tertiary-bg);
  border: 1px solid transparent;
  border-radius: var(--bs-border-radius-sm, .375rem);
  outline: none;
}

.care-tp__input:focus {
  background: var(--bs-body-bg);
  border-color: var(--care-primary, var(--bs-primary));
  box-shadow: var(--care-focus-ring, 0 0 0 3px rgb(13 110 253 / .35));
}

.care-tp__row.is-invalid .care-tp__input {
  border-color: var(--bs-danger, #dc3545);
}

.care-tp__actions {
  display: inline-flex;
  margin-left: auto;
}

.care-tp__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  font-size: .75rem;
  color: var(--bs-secondary-color);
  background: transparent;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
}

.care-tp__icon:hover:not(:disabled) {
  color: var(--bs-body-color);
  background: var(--bs-secondary-bg);
}

.care-tp__icon.is-danger:hover:not(:disabled) {
  color: var(--bs-danger, #dc3545);
  background: color-mix(in srgb, var(--bs-danger, #dc3545) 12%, transparent);
}

.care-tp__icon:disabled {
  opacity: .3;
  cursor: default;
}

.care-tp__icon:focus-visible {
  outline: none;
  box-shadow: var(--care-focus-ring, 0 0 0 3px rgb(13 110 253 / .35));
}

.care-tp__error {
  flex: 1 1 100%;
  order: 10;
  padding-left: 2.6rem;
  font-size: .7rem;
  color: var(--bs-danger, #dc3545);
}

.care-tp__empty {
  margin: .5rem 0;
  font-size: .8rem;
  text-align: center;
  color: var(--bs-secondary-color);
}

.care-tp__add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: .4rem;
  width: 100%;
  padding: .4rem;
  font-size: .8rem;
  font-weight: 500;
  color: var(--care-primary, var(--bs-primary));
  background: transparent;
  border: 1px dashed color-mix(in srgb, var(--care-primary, var(--bs-primary)) 50%, transparent);
  border-radius: var(--bs-border-radius, .5rem);
  cursor: pointer;
  transition: background-color var(--care-dur-fast, 120ms) ease;
}

.care-tp__add:hover {
  background: color-mix(in srgb, var(--care-primary, var(--bs-primary)) 8%, transparent);
}

.care-tp__add:focus-visible {
  outline: none;
  box-shadow: var(--care-focus-ring, 0 0 0 3px rgb(13 110 253 / .35));
}

@media (prefers-reduced-motion: reduce) {
  .care-tp__row,
  .care-tp__list.is-sorting .care-tp__row {
    transition: none;
  }
}
</style>
