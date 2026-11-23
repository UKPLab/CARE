<template>
  <FormElement :options="options">
    <template #element>
      <div
        class="care-slider w-100"
        :class="[options.class, { 'is-range': isRange, 'is-disabled': isDisabled }]"
        :style="trackStyle"
      >
        <div class="care-slider__head">
          <output
            class="care-slider__value"
            :for="isRange ? `${options.key}_low ${options.key}` : options.key"
          >
            <template v-if="isRange">
              <span>{{ displayFor(low, false) }}</span>
              <span class="care-slider__dash">–</span>
              <span>{{ displayFor(high, true) }}</span>
            </template>
            <span v-else>{{ displayFor(high, true) }}</span>
            <span
              v-if="'unit' in options"
              class="care-slider__unit"
            >{{ translateMaybeKey(options.unit) }}</span>
          </output>
        </div>

        <div class="care-slider__control">
          <div
            class="care-slider__track"
            aria-hidden="true"
          >
            <div class="care-slider__fill" />
          </div>
          <input
            v-if="isRange"
            :id="options.key + '_low'"
            class="care-slider__input"
            :class="{ 'is-top': lowOnTop }"
            type="range"
            :min="min"
            :max="max"
            :step="step"
            :value="low"
            :disabled="isDisabled"
            :aria-label="rangeAriaLabel('from')"
            :aria-valuetext="ariaText(low, false)"
            @input="onLowInput"
          >
          <input
            :id="options.key"
            class="care-slider__input"
            type="range"
            :min="min"
            :max="max"
            :step="step"
            :value="high"
            :disabled="isDisabled"
            :aria-label="isRange ? rangeAriaLabel('to') : undefined"
            :aria-valuetext="ariaText(high, true)"
            @input="onHighInput"
          >
        </div>

        <div
          v-if="options.showBounds !== false"
          class="care-slider__bounds"
          aria-hidden="true"
        >
          <span>{{ displayFor(min, false) }}</span>
          <span>{{ displayFor(max, true) }}</span>
        </div>
      </div>
    </template>
  </FormElement>
</template>

<script>
import FormElement from "@/basic/form/Element.vue"
import { translateMaybeKey } from "@/assets/utils"

/**
 * Slider for a single number or, with `options.range: true`, for a range.
 *
 * Single mode: v-model is a number.
 * Range mode: v-model is `[low, high]`; the two thumbs cannot cross. Set
 * `options.valueAsObject: true` to get `{ min, max }` instead of an array.
 *
 * Other options: min, max, step, unit, textMapping ([{from, to}]),
 * unlimitedAtMax / unlimitedLabel / unlimitedStoredValue (applies to the upper
 * thumb), showBounds (false hides the min / max labels under the track),
 * readOnly / disabled.
 */
export default {
  name: "FormSlider",
  components: {FormElement},
  props: {
    options: {
      type: Object,
      required: true,
    },
    modelValue: {
      type: [Number, Array, Object],
      required: false,
      default: 0,
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      low: 0,
      high: 0,
    }
  },
  computed: {
    isRange() {
      return Boolean(this.options.range);
    },
    isDisabled() {
      return Boolean(this.options.disabled) || Boolean(this.options.readOnly);
    },
    min() {
      return Number(this.options.min ?? 0);
    },
    max() {
      return Number(this.options.max ?? 100);
    },
    step() {
      return this.options.step ?? 1;
    },
    span() {
      return this.max - this.min || 1;
    },
    unlimitedStoredValue() {
      return Number(this.options.unlimitedStoredValue ?? 0);
    },
    hasUnlimitedAtMax() {
      return Boolean(this.options.unlimitedAtMax);
    },
    /** Track fill as fractions (0..1); the CSS turns them into thumb-aligned positions. */
    trackStyle() {
      const fraction = (value) => Math.min(1, Math.max(0, (value - this.min) / this.span));
      return {
        "--slider-from": this.isRange ? fraction(this.low) : 0,
        "--slider-to": fraction(this.high),
      };
    },
    /**
     * With both thumbs on the same spot only the top one can be grabbed. Put the
     * lower thumb on top in the upper half, so it can still be dragged left.
     */
    lowOnTop() {
      return this.low >= this.high && this.low > this.min + this.span / 2;
    },
    emittedValue() {
      const high = this.hasUnlimitedAtMax && this.high === this.max ? this.unlimitedStoredValue : this.high;
      if (!this.isRange) return high;
      return this.options.valueAsObject ? {min: this.low, max: high} : [this.low, high];
    },
  },
  watch: {
    modelValue: {
      handler() {
        this.syncFromModel();
      },
      deep: true,
    },
  },
  beforeMount() {
    this.syncFromModel();
    // Report the clamped / defaulted start value (e.g. an unset field becomes min)
    if (JSON.stringify(this.emittedValue) !== JSON.stringify(this.modelValue)) {
      this.emit();
    }
  },
  methods: {
    translateMaybeKey,
    clamp(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) return this.min;
      return Math.min(this.max, Math.max(this.min, number));
    },
    /** Upper value from the model, with the "unlimited" stored value mapped back to max. */
    normalizeHigh(value) {
      if (this.hasUnlimitedAtMax && Number(value) === this.unlimitedStoredValue) {
        return this.max;
      }
      return this.clamp(value);
    },
    syncFromModel() {
      const value = this.modelValue;
      if (this.isRange) {
        let low = this.min;
        let high = this.max;
        if (Array.isArray(value)) {
          [low = this.min, high = this.max] = value;
        } else if (value && typeof value === "object") {
          low = value.min ?? this.min;
          high = value.max ?? this.max;
        }
        this.low = this.clamp(low);
        this.high = Math.max(this.low, this.normalizeHigh(high));
      } else {
        this.high = this.normalizeHigh(value);
      }
    },
    onLowInput(event) {
      const value = Math.min(Number(event.target.value), this.high);
      event.target.value = value;
      this.low = value;
      this.emit();
    },
    onHighInput(event) {
      let value = Number(event.target.value);
      if (this.isRange) {
        value = Math.max(value, this.low);
        event.target.value = value;
      }
      this.high = value;
      this.emit();
    },
    emit() {
      this.$emit("update:modelValue", this.emittedValue);
    },
    /**
     * Text shown for a slider position.
     * @param {number} value
     * @param {boolean} isUpper Whether this is the upper / single thumb ("unlimited" applies to it only).
     * @returns {string|number}
     */
    displayFor(value, isUpper) {
      if (isUpper && this.hasUnlimitedAtMax && value === this.max) {
        return translateMaybeKey(this.options.unlimitedLabel || "unlimited");
      }
      if (Array.isArray(this.options.textMapping)) {
        const mapping = this.options.textMapping.find((item) => item.from === value);
        if (mapping) return translateMaybeKey(mapping.to);
      }
      return value;
    },
    ariaText(value, isUpper) {
      const unit = "unit" in this.options ? ` ${translateMaybeKey(this.options.unit)}` : "";
      return `${this.displayFor(value, isUpper)}${unit}`;
    },
    rangeAriaLabel(part) {
      const label = "label" in this.options ? translateMaybeKey(this.options.label) : "";
      const key = part === "from" ? "common.rangeFrom" : "common.rangeTo";
      return label ? `${label} (${this.$t(key)})` : this.$t(key);
    },
  },
}
</script>

<style scoped>
/* Geometry: the thumb centre travels from thumb/2 to 100% - thumb/2, so the
   fill uses the same formula and always ends exactly under the thumb. */
.care-slider {
  --slider-thumb: 18px;
  --slider-track-h: 6px;
  --slider-track-bg: var(--bs-secondary-bg);
  --slider-fill: var(--care-primary);
  --slider-thumb-bg: var(--bs-body-bg);

  display: flex;
  flex-direction: column;
  gap: .35rem;
  padding-top: .1rem;
}

[data-bs-theme="dark"] .care-slider {
  --slider-track-bg: rgba(255, 255, 255, .09);
  --slider-thumb-bg: color-mix(in srgb, var(--bs-body-bg) 82%, #ffffff 18%);
}

.care-slider__head {
  display: flex;
  justify-content: flex-start;
}

.care-slider__value {
  display: inline-flex;
  align-items: baseline;
  gap: .3rem;
  padding: .1rem .55rem;
  border-radius: var(--care-radius-pill);
  background: rgba(var(--care-violet-rgb), .1);
  color: var(--bs-emphasis-color);
  font-size: .875rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  line-height: 1.5;
}

.care-slider__dash {
  color: var(--bs-secondary-color);
}

.care-slider__unit {
  color: var(--bs-secondary-color);
  font-weight: 400;
}

.care-slider__control {
  position: relative;
  height: calc(var(--slider-thumb) + 6px);
}

.care-slider__track {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: var(--slider-track-h);
  transform: translateY(-50%);
  border-radius: var(--care-radius-pill);
  background: var(--slider-track-bg);
  overflow: hidden;
}

.care-slider__fill {
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(var(--slider-thumb) / 2 + var(--slider-from) * (100% - var(--slider-thumb)));
  right: calc(100% - (var(--slider-thumb) / 2 + var(--slider-to) * (100% - var(--slider-thumb))));
  border-radius: inherit;
  background: var(--slider-fill);
  transition: left 80ms linear, right 80ms linear;
}

/* Single slider: fill starts at the very edge of the track */
.care-slider:not(.is-range) .care-slider__fill {
  left: 0;
}

/* Native inputs stay for keyboard + screen readers; only the thumbs are drawn */
.care-slider__input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  background: transparent;
  appearance: none;
  -webkit-appearance: none;
  pointer-events: none;
  outline: none;
  z-index: 2;
}

.care-slider__input.is-top {
  z-index: 3;
}

.care-slider__input::-webkit-slider-runnable-track {
  height: 100%;
  background: transparent;
  border: 0;
}

.care-slider__input::-moz-range-track {
  height: 100%;
  background: transparent;
  border: 0;
}

.care-slider__input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: var(--slider-thumb);
  height: var(--slider-thumb);
  margin-top: 3px; /* (control height - thumb) / 2 */
  border: 2px solid var(--slider-fill);
  border-radius: 50%;
  background: var(--slider-thumb-bg);
  box-shadow: 0 1px 3px rgb(var(--care-shadow-rgb) / .25);
  cursor: grab;
  pointer-events: auto;
  transition: box-shadow 150ms var(--care-ease), transform 150ms var(--care-ease);
}

.care-slider__input::-moz-range-thumb {
  box-sizing: border-box;
  width: var(--slider-thumb);
  height: var(--slider-thumb);
  border: 2px solid var(--slider-fill);
  border-radius: 50%;
  background: var(--slider-thumb-bg);
  box-shadow: 0 1px 3px rgb(var(--care-shadow-rgb) / .25);
  cursor: grab;
  pointer-events: auto;
  transition: box-shadow 150ms var(--care-ease), transform 150ms var(--care-ease);
}

.care-slider__input:not(:disabled)::-webkit-slider-thumb:hover {
  box-shadow: 0 0 0 6px color-mix(in srgb, var(--slider-fill) 16%, transparent);
}

.care-slider__input:not(:disabled)::-moz-range-thumb:hover {
  box-shadow: 0 0 0 6px color-mix(in srgb, var(--slider-fill) 16%, transparent);
}

.care-slider__input:not(:disabled):active::-webkit-slider-thumb {
  cursor: grabbing;
  transform: scale(1.08);
  box-shadow: 0 0 0 8px color-mix(in srgb, var(--slider-fill) 20%, transparent);
}

.care-slider__input:not(:disabled):active::-moz-range-thumb {
  cursor: grabbing;
  transform: scale(1.08);
  box-shadow: 0 0 0 8px color-mix(in srgb, var(--slider-fill) 20%, transparent);
}

.care-slider__input:focus-visible::-webkit-slider-thumb {
  box-shadow: var(--care-focus-ring);
}

.care-slider__input:focus-visible::-moz-range-thumb {
  box-shadow: var(--care-focus-ring);
}

.care-slider__bounds {
  display: flex;
  justify-content: space-between;
  padding: 0 calc(var(--slider-thumb) / 2 - 4px);
  margin-top: -.2rem;
  font-size: .75rem;
  color: var(--bs-tertiary-color);
  font-variant-numeric: tabular-nums;
}

.care-slider.is-disabled {
  opacity: .55;
}

.care-slider.is-disabled .care-slider__input::-webkit-slider-thumb {
  cursor: not-allowed;
}

.care-slider.is-disabled .care-slider__input::-moz-range-thumb {
  cursor: not-allowed;
}

@media (prefers-reduced-motion: reduce) {
  .care-slider__fill,
  .care-slider__input::-webkit-slider-thumb,
  .care-slider__input::-moz-range-thumb {
    transition: none;
  }
}
</style>
