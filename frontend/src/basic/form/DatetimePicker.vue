<template>
  <FormElement ref="formElement" :options="options">
    <template #element>
      <!-- Inline: the calendar is always visible (table search). mousedown is cancelled so the
           search field keeps focus while the user clicks around. -->
      <div
        v-if="inline"
        class="care-dp-inline"
        @mousedown.prevent
      >
        <CalendarPanel
          :show-today="false"
          :selected="date"
          :time="time"
          :show-time="!dateOnly"
          :zone="dateOnly ? null : zone"
          :presets="timePresets"
          :min="minDate"
          :max="maxDate"
          :locale="localeCode"
          @select="onSelectDate"
          @update:time="onSelectTime"
          @update:presets="onUpdatePresets"
          @update:zone="onSelectZone"
        />
      </div>

      <!-- Popup: a field that opens the calendar (+ time row) -->
      <div
        v-else
        ref="trigger"
        class="care-dp-trigger form-control"
        :class="{ 'is-open': isOpen, 'has-value': !!date }"
      >
        <button
          :id="options.key"
          ref="triggerButton"
          type="button"
          class="care-dp-trigger__main"
          aria-haspopup="dialog"
          :aria-expanded="isOpen ? 'true' : 'false'"
          :aria-controls="popupId"
          @click="toggle"
          @keydown.down.prevent="open"
          @keydown.esc="onTriggerEscape"
        >
          <LoadIcon class="care-dp-trigger__icon" icon-name="calendar3" :size="15" />
          <span
            class="care-dp-trigger__text"
            :class="{ 'is-placeholder': !date }"
          >{{ displayText }}</span>
          <span
            v-if="date && !dateOnly"
            class="care-dp-trigger__zone"
            :class="{ 'is-custom': !zone.isDevice }"
            :title="[zone.name, zone.label].filter(Boolean).join(' · ')"
          >
            <template v-if="!zone.isDevice">{{ zone.city }} · </template>{{ zone.offset }}
          </span>
        </button>
        <!-- BasicButton's click event has no DOM event, so the native click is stopped in capture -->
        <BasicButton
          v-if="date"
          class="btn-icon btn-sm care-dp-trigger__clear"
          :title="$t('common.reset')"
          :aria-label="$t('common.reset')"
          @click.capture.stop
          @click="clear"
        >
          <LoadIcon icon-name="x-lg" :size="11" />
        </BasicButton>
      </div>

      <!-- Inside a modal the popup goes into the .modal itself, otherwise Bootstrap's focus trap
           pulls focus back to the modal's close button -->
      <Teleport
        v-if="!inline"
        :to="teleportTarget"
      >
        <Transition name="care-dp-pop">
          <div
            v-if="isOpen"
            :id="popupId"
            ref="popup"
            class="care-dp-popup"
            role="dialog"
            :aria-label="options.label ? translateMaybeKey(options.label) : $t('common.datePicker.placeholder')"
            :style="popupStyle"
            @keydown.esc.stop.prevent="close()"
          >
            <CalendarPanel
              :selected="date"
              :time="time"
              :show-time="!dateOnly"
              :zone="dateOnly ? null : zone"
              :presets="timePresets"
              :min="minDate"
              :max="maxDate"
              :locale="localeCode"
              @select="onSelectDate"
              @update:time="onSelectTime"
              @update:presets="onUpdatePresets"
              @update:zone="onSelectZone"
            >
              <template #footer>
                <button
                  v-if="!dateOnly"
                  type="button"
                  class="care-dp-done"
                  @click="close()"
                >
                  {{ $t('common.datePicker.done') }}
                </button>
              </template>
            </CalendarPanel>
          </div>
        </Transition>
      </Teleport>
    </template>
  </FormElement>
</template>

<script>
import FormElement from "@/basic/form/Element.vue"
import LoadIcon from "@/basic/Icon.vue";
import BasicButton from "@/basic/Button.vue";
import CalendarPanel from "@/basic/form/CalendarPanel.vue";
import { formatLocalizedDate, formatLocalizedDateTime, translateMaybeKey } from "@/assets/utils";
import {datetimePrefs, setPreferredTimeZone, setTimePresets} from "@/basic/form/datetimePrefs";
import {bindPopupListeners, placePopup, popupTeleportTarget, uniqueId} from "@/basic/form/helpers/listbox";
import {
  dayOffsets,
  deviceTimeZone,
  dstInfo,
  formatOffset,
  splitZoneId,
  zonedParts,
  zonedToUtc,
  zoneName,
} from "@/basic/form/timeZone";

/**
 * Date (and optional time) picker.
 *
 * Value is an ISO string (or null). Props:
 * - `dateOnly`: no time row, time is always 00:00 in the device zone
 * - `inline`: render the calendar directly instead of a field with a popup (used by the table search)
 * Optional `options.min` / `options.max` ("YYYY-MM-DD") limit the selectable days.
 *
 * Times are wall-clock times in the user's chosen time zone (device zone by default; the choice
 * and the quick-time buttons are kept in localStorage, see datetimePrefs). The zone and its UTC
 * offset for the selected day are shown, so summer/winter time is visible. Times skipped by a
 * clock change (e.g. 02:30 on the spring-forward day) are moved to a real time and the user is
 * told. Repeated times on the fall-back day resolve to the first occurrence (the offset shows which).
 */
export default {
  name: "DatetimePicker",
  components: {FormElement, CalendarPanel, LoadIcon, BasicButton},
  props: {
    options: {
      type: Object,
      required: true
    },
    modelValue: {
      type: [String, null],
      required: true
    },
    dateOnly: {
      type: Boolean,
      required: false,
      default: false,
    },
    inline: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      date: null, // "YYYY-MM-DD"
      time: null, // "HH:MM"
      adjustedFrom: null, // "HH:MM" the user asked for when it fell into a clock-change gap
      keepWallClock: false, // set while this picker itself changes the zone
      isOpen: false,
      popupStyle: {},
      teleportTarget: "body",
      uid: uniqueId(),
    }
  },
  computed: {
    localeCode() {
      const locale = this.$i18n?.locale;
      return typeof locale === "string" ? locale : locale?.value;
    },
    popupId() {
      return `care-dp-popup-${this.uid}`;
    },
    minDate() {
      return this.options.min || null;
    },
    maxDate() {
      return this.options.max || null;
    },
    /** Zone the fields are in: the user's choice, else the device. Date-only always uses the device. */
    timeZoneId() {
      return (!this.dateOnly && datetimePrefs.timeZone) || deviceTimeZone();
    },
    timePresets() {
      return datetimePrefs.timePresets;
    },
    /** Selected moment as a timestamp, or null. */
    currentTs() {
      if (!this.date) return null;
      const ts = zonedToUtc(this.timeZoneId, this.date, this.time || "00:00");
      return Number.isNaN(ts) ? null : ts;
    },
    currentDate() {
      return this.currentTs === null ? null : new Date(this.currentTs);
    },
    /** Selected moment as an ISO string (what the parent receives), or null. */
    currentIso() {
      return this.currentDate ? this.currentDate.toISOString() : null;
    },
    displayText() {
      if (!this.currentDate) return this.$t("common.datePicker.placeholder");
      return this.dateOnly
        ? formatLocalizedDate(this.currentDate, {dateStyle: "medium"})
        : formatLocalizedDateTime(this.currentDate, {dateStyle: "medium", timeStyle: "short", timeZone: this.timeZoneId});
    },
    /** Time zone facts for the selected moment (or now): name, offset, summer/winter time, notices. */
    zone() {
      const id = this.timeZoneId;
      const at = this.currentTs ?? Date.now();
      const {offset, observesDst, isDst} = dstInfo(id, at);

      let notice = "";
      if (this.date) {
        const {before, after} = dayOffsets(id, this.date);
        if (this.adjustedFrom) {
          notice = this.$t("common.datePicker.timeAdjusted", {requested: this.adjustedFrom, actual: this.time});
        } else if (before !== after) {
          notice = this.$t("common.datePicker.clockChange", {from: formatOffset(before), to: formatOffset(after)});
        }
      }

      return {
        id,
        label: id.replace(/_/g, " "),
        city: id === "UTC" ? "UTC" : splitZoneId(id).city,
        name: zoneName(id, at, this.localeCode),
        offset: formatOffset(offset),
        observesDst,
        isDst,
        isDevice: id === deviceTimeZone(),
        at,
        notice,
      };
    },
  },
  watch: {
    modelValue() {
      // Ignore the echo of our own emit
      if (this.modelValue !== this.currentIso) {
        this.applyValue(this.modelValue);
      }
    },
    /**
     * Zone picked in this picker: keep the typed wall-clock time ("14:00 in New York") and emit the
     * new moment. Zone changed in another picker (shared setting): keep the saved moment and only
     * show it in the new zone.
     */
    timeZoneId() {
      if (!this.date) {
        this.keepWallClock = false;
        return;
      }
      if (this.keepWallClock) {
        this.keepWallClock = false;
        this.normalize();
        this.emitValue();
      } else {
        this.applyValue(this.modelValue);
      }
    },
  },
  mounted() {
    this.teleportTarget = popupTeleportTarget(this.$el);
    this.applyValue(this.modelValue);
  },
  beforeUnmount() {
    this.unbindPopup?.();
  },
  methods: {
    translateMaybeKey,
    applyValue(value) {
      const ts = value ? Date.parse(value) : NaN;
      this.adjustedFrom = null;
      if (Number.isNaN(ts)) {
        this.date = null;
        this.time = null;
        return;
      }
      const {ymd, hm} = zonedParts(this.timeZoneId, ts);
      this.date = ymd;
      this.time = this.dateOnly ? "00:00" : hm;
    },
    emitValue() {
      this.$emit("update:modelValue", this.currentIso);
    },
    /**
     * Keep date/time in sync with the moment that is actually emitted. A wall-clock time inside a
     * spring-forward gap does not exist; it is moved forward by the gap, so the fields would
     * otherwise show 02:30 while 03:30 is saved.
     * @param {number|null} previousTs Moment before this edit, to keep stepping backwards going backwards.
     * @returns {void}
     */
    normalize(previousTs = null) {
      const actual = this.currentTs;
      if (this.dateOnly || actual === null) return;
      const zone = this.timeZoneId;
      const real = zonedParts(zone, actual);
      if (real.ymd === this.date && real.hm === this.time) {
        this.adjustedFrom = null;
        return;
      }
      const requested = this.time;
      let fixed = actual;
      // Stepping down from 03:00 to 02:55 should land at 01:55, not jump forward to 03:55
      if (previousTs !== null) {
        const previous = zonedParts(zone, previousTs);
        if (previous.ymd === this.date && requested < previous.hm && actual > previousTs) {
          const {before, after} = dayOffsets(zone, this.date);
          fixed = actual - (after - before) * 60000;
        }
      }
      const result = zonedParts(zone, fixed);
      this.date = result.ymd;
      this.time = result.hm;
      this.adjustedFrom = requested;
    },
    onSelectDate(ymd) {
      this.date = ymd;
      if (this.time === null) this.time = "00:00";
      this.normalize();
      this.emitValue();
      // Date-only popups are done after one click; with a time row the popup stays open
      if (this.dateOnly && !this.inline) this.close();
    },
    onSelectTime(value) {
      if (!this.date) return;
      const previous = this.currentTs;
      this.time = value;
      this.normalize(previous);
      this.emitValue();
    },
    /** @param {string|null} zone Picked zone id, null = device. */
    onSelectZone(zone) {
      const before = this.timeZoneId;
      this.keepWallClock = true;
      setPreferredTimeZone(zone);
      // Same zone again: the watcher will not run, so do not leave the flag set
      if (this.timeZoneId === before) this.keepWallClock = false;
    },
    onUpdatePresets(list) {
      setTimePresets(list);
    },
    clear() {
      this.date = null;
      this.time = null;
      this.adjustedFrom = null;
      this.emitValue();
      this.validate();
    },
    toggle() {
      this.isOpen ? this.close() : this.open();
    },
    /** Escape closes only the popup, not a surrounding modal. */
    onTriggerEscape(event) {
      if (!this.isOpen) return;
      event.stopPropagation();
      event.preventDefault();
      this.close();
    },
    open() {
      if (this.isOpen) return;
      this.isOpen = true;
      this.updatePosition();
      this.unbindPopup = bindPopupListeners({
        isInside: (target) => this.$refs.trigger?.contains(target) || this.$refs.popup?.contains(target),
        onOutside: () => this.close(false),
        onReposition: this.updatePosition,
      });
      this.$nextTick(() => {
        this.updatePosition();
        this.$refs.popup?.querySelector('.care-cal__day[tabindex="0"]')?.focus({preventScroll: true});
      });
    },
    /**
     * @param {boolean} [focusTrigger] Return focus to the field.
     * @returns {void}
     */
    close(focusTrigger = true) {
      if (!this.isOpen) return;
      this.isOpen = false;
      this.unbindPopup?.();
      this.unbindPopup = null;
      if (focusTrigger) this.$refs.triggerButton?.focus({preventScroll: true});
      this.validate();
    },
    /** Pin the calendar popup to the field. @returns {void} */
    updatePosition() {
      const trigger = this.$refs.trigger;
      if (!trigger) return;
      const width = Math.min(320, window.innerWidth - 16);
      // The calendar does not scroll: open upward whenever all of it does not fit below, never cap its height
      const {style} = placePopup(trigger.getBoundingClientRect(), this.$refs.popup, {
        width,
        gap: 6,
        margin: 8,
        minSpaceBelow: Infinity,
      });
      delete style.maxHeight;
      this.popupStyle = style;
    },
    validate() {
      return this.$refs.formElement.validate(this.currentIso);
    }
  }
}
</script>

<style scoped>
.care-dp-inline {
  flex: 1 1 100%;
  min-width: 0;
}

/* ---------- Field ---------- */
.care-dp-trigger {
  display: flex;
  align-items: center;
  padding: 0;
  cursor: pointer;
  transition: border-color var(--care-dur-fast) var(--care-ease),
              box-shadow var(--care-dur-fast) var(--care-ease);
}

.care-dp-trigger.is-open,
.care-dp-trigger:focus-within {
  border-color: var(--care-primary);
  box-shadow: var(--care-focus-ring);
}

.care-dp-trigger__main {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  gap: .6rem;
  min-width: 0;
  padding: .375rem .75rem;
  color: inherit;
  font: inherit;
  text-align: left;
  background: transparent;
  border: 0;
  outline: none;
  cursor: pointer;
}

.care-dp-trigger__icon {
  color: var(--bs-secondary-color);
}

.care-dp-trigger.has-value .care-dp-trigger__icon {
  color: var(--care-primary);
}

.care-dp-trigger__text {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.care-dp-trigger__text.is-placeholder {
  color: var(--bs-secondary-color);
}

.care-dp-trigger__zone {
  flex: 0 0 auto;
  margin-left: auto;
  padding: .05rem .45rem;
  font-size: .72rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: .01em;
  white-space: nowrap;
  color: var(--bs-secondary-color);
  background: var(--bs-tertiary-bg);
  border-radius: var(--care-radius-pill);
}

/* Not the device zone: make it hard to miss */
.care-dp-trigger__zone.is-custom {
  color: var(--care-primary);
  background: color-mix(in srgb, var(--care-primary) 12%, transparent);
}

.care-dp-trigger__clear {
  flex: 0 0 auto;
  margin-right: .4rem;
  border-radius: 50%;
}

/* ---------- Popup (teleported) ---------- */
.care-dp-popup {
  position: fixed;
  z-index: var(--care-z-popover); /* above Bootstrap modals (1055) */
  padding: .75rem;
  color: var(--bs-body-color);
  background: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color-translucent);
  border-radius: var(--care-radius-lg);
  box-shadow: var(--care-shadow-3);
}

.care-dp-done {
  padding: .3rem .9rem;
  font-size: .85rem;
  font-weight: 500;
  color: var(--care-on-primary);
  background: var(--care-primary);
  border: 0;
  border-radius: var(--care-radius-pill);
  cursor: pointer;
  transition: filter var(--care-dur-fast) ease;
}

.care-dp-done:hover {
  filter: brightness(1.08);
}

.care-dp-done:focus-visible {
  outline: none;
  box-shadow: var(--care-focus-ring);
}

.care-dp-pop-enter-active,
.care-dp-pop-leave-active {
  transition: opacity 120ms ease, transform 140ms var(--care-ease);
}

.care-dp-pop-enter-from,
.care-dp-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(.98);
}

@media (prefers-reduced-motion: reduce) {
  .care-dp-trigger,
  .care-dp-pop-enter-active,
  .care-dp-pop-leave-active {
    transition: none;
  }
}
</style>
