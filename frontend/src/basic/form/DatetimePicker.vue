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
          :min="minDate"
          :max="maxDate"
          :locale="localeCode"
          @select="onSelectDate"
          @update:time="onSelectTime"
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
          <i class="bi bi-calendar3 care-dp-trigger__icon" aria-hidden="true"></i>
          <span
            class="care-dp-trigger__text"
            :class="{ 'is-placeholder': !date }"
          >{{ displayText }}</span>
        </button>
        <button
          v-if="date"
          type="button"
          class="care-dp-trigger__clear"
          :title="$t('common.reset')"
          :aria-label="$t('common.reset')"
          @click.stop="clear"
        >
          <i class="bi bi-x-lg" aria-hidden="true"></i>
        </button>
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
              :min="minDate"
              :max="maxDate"
              :locale="localeCode"
              @select="onSelectDate"
              @update:time="onSelectTime"
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
import CalendarPanel from "@/basic/form/CalendarPanel.vue";
import { formatLocalizedDate, formatLocalizedDateTime, translateMaybeKey } from "@/assets/utils";

const pad = (n) => String(n).padStart(2, "0");

/**
 * Date (and optional time) picker.
 *
 * Value is an ISO string (or null). Props:
 * - `dateOnly`: no time row, time is always 00:00
 * - `inline`: render the calendar directly instead of a field with a popup (used by the table search)
 * Optional `options.min` / `options.max` ("YYYY-MM-DD") limit the selectable days.
 */
export default {
  name: "DatetimePicker",
  components: {FormElement, CalendarPanel},
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
      isOpen: false,
      popupStyle: {},
      teleportTarget: "body",
    }
  },
  computed: {
    localeCode() {
      const locale = this.$i18n?.locale;
      return typeof locale === "string" ? locale : locale?.value;
    },
    popupId() {
      return `care-dp-popup-${this.$.uid}`;
    },
    minDate() {
      return this.options.min || null;
    },
    maxDate() {
      return this.options.max || null;
    },
    /** Selected moment as a Date (local time), or null. */
    currentDate() {
      if (!this.date) return null;
      return new Date(`${this.date}T${this.time || "00:00"}`);
    },
    /** Selected moment as an ISO string (what the parent receives), or null. */
    currentIso() {
      const date = this.currentDate;
      return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
    },
    displayText() {
      if (!this.currentDate) return this.$t("common.datePicker.placeholder");
      return this.dateOnly
        ? formatLocalizedDate(this.currentDate, {dateStyle: "medium"})
        : formatLocalizedDateTime(this.currentDate, {dateStyle: "medium", timeStyle: "short"});
    },
  },
  watch: {
    modelValue() {
      // Ignore the echo of our own emit
      if (this.modelValue !== this.currentIso) {
        this.applyValue(this.modelValue);
      }
    },
  },
  mounted() {
    this.teleportTarget = this.$el.closest?.(".modal") || "body";
    this.applyValue(this.modelValue);
  },
  beforeUnmount() {
    this.removeListeners();
  },
  methods: {
    translateMaybeKey,
    applyValue(value) {
      const parsed = value ? new Date(value) : null;
      if (!parsed || Number.isNaN(parsed.getTime())) {
        this.date = null;
        this.time = null;
        return;
      }
      this.date = `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
      this.time = this.dateOnly ? "00:00" : `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
    },
    emitValue() {
      this.$emit("update:modelValue", this.currentIso);
    },
    onSelectDate(ymd) {
      this.date = ymd;
      if (this.time === null) this.time = "00:00";
      this.emitValue();
      // Date-only popups are done after one click; with a time row the popup stays open
      if (this.dateOnly && !this.inline) this.close();
    },
    onSelectTime(value) {
      if (!this.date) return;
      this.time = value;
      this.emitValue();
    },
    clear() {
      this.date = null;
      this.time = null;
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
      document.addEventListener("pointerdown", this.onOutsidePointer, true);
      window.addEventListener("resize", this.updatePosition);
      window.addEventListener("scroll", this.updatePosition, true);
      this.$nextTick(() => {
        this.updatePosition();
        this.$refs.popup?.querySelector('.care-cal__day[tabindex="0"]')?.focus({preventScroll: true});
      });
    },
    close(focusTrigger = true) {
      if (!this.isOpen) return;
      this.isOpen = false;
      this.removeListeners();
      if (focusTrigger) this.$refs.triggerButton?.focus({preventScroll: true});
      this.validate();
    },
    removeListeners() {
      document.removeEventListener("pointerdown", this.onOutsidePointer, true);
      window.removeEventListener("resize", this.updatePosition);
      window.removeEventListener("scroll", this.updatePosition, true);
    },
    onOutsidePointer(event) {
      const inTrigger = this.$refs.trigger?.contains(event.target);
      const inPopup = this.$refs.popup?.contains(event.target);
      if (!inTrigger && !inPopup) this.close(false);
    },
    updatePosition() {
      const trigger = this.$refs.trigger;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(320, window.innerWidth - 16);
      const height = this.$refs.popup?.offsetHeight || (this.dateOnly ? 360 : 470);
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      const openUp = spaceBelow < height && spaceAbove > spaceBelow;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      this.popupStyle = {
        left: `${Math.round(left)}px`,
        width: `${width}px`,
        ...(openUp
          ? {bottom: `${Math.round(window.innerHeight - rect.top + 6)}px`}
          : {top: `${Math.round(rect.bottom + 6)}px`}),
      };
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
  transition: border-color var(--care-dur-fast, 120ms) var(--care-ease, ease),
              box-shadow var(--care-dur-fast, 120ms) var(--care-ease, ease);
}

.care-dp-trigger.is-open,
.care-dp-trigger:focus-within {
  border-color: var(--care-primary, var(--bs-primary));
  box-shadow: var(--care-focus-ring, 0 0 0 3px rgb(13 110 253 / .35));
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
  color: var(--care-primary, var(--bs-primary));
}

.care-dp-trigger__text {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.care-dp-trigger__text.is-placeholder {
  color: var(--bs-secondary-color);
}

.care-dp-trigger__clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  margin-right: .4rem;
  padding: 0;
  font-size: .7rem;
  color: var(--bs-secondary-color);
  background: transparent;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
}

.care-dp-trigger__clear:hover {
  color: var(--bs-body-color);
  background: var(--bs-secondary-bg);
}

.care-dp-trigger__clear:focus-visible {
  outline: none;
  box-shadow: var(--care-focus-ring, 0 0 0 3px rgb(13 110 253 / .35));
}

/* ---------- Popup (teleported) ---------- */
.care-dp-popup {
  position: fixed;
  z-index: 1080; /* above Bootstrap modals (1055) */
  padding: .75rem;
  color: var(--bs-body-color);
  background: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color-translucent);
  border-radius: var(--bs-border-radius-lg, .75rem);
  box-shadow: var(--care-shadow-3, 0 12px 24px -6px rgb(0 0 0 / .2));
}

.care-dp-done {
  padding: .3rem .9rem;
  font-size: .85rem;
  font-weight: 500;
  color: var(--care-on-primary, #fff);
  background: var(--care-primary, var(--bs-primary));
  border: 0;
  border-radius: var(--bs-border-radius-pill, 999px);
  cursor: pointer;
  transition: filter var(--care-dur-fast, 120ms) ease;
}

.care-dp-done:hover {
  filter: brightness(1.08);
}

.care-dp-done:focus-visible {
  outline: none;
  box-shadow: var(--care-focus-ring, 0 0 0 3px rgb(13 110 253 / .35));
}

.care-dp-pop-enter-active,
.care-dp-pop-leave-active {
  transition: opacity 120ms ease, transform 140ms var(--care-ease, ease);
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
