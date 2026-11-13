<template>
  <FormElement ref="formElement" :options="options">
    <template #element>
      <input
        v-model="date"
        class="form-control"
        type="date"
        :lang="localeCode"
        :min="options.disablePast ? today : undefined"
        @blur="validate"
      >
      <input
        v-if="!dateOnly"
        v-model="time"
        class="form-control"
        type="time"
        :lang="localeCode"
        :min="options.disablePast && date === today ? currentTime : undefined"
        @blur="validate"
      >
      <button
        v-if="!dateOnly"
        class="btn btn-outline-secondary"
        type="button"
        @click="date = null"
      >
        {{ $t('common.reset') }}
      </button>
    </template>
  </FormElement>
</template>

<script>
import FormElement from "@/basic/form/Element.vue"

export default {
  name: "DatetimePicker",
  components: {FormElement},
  inject: {
    validateDateValue: {
      default: null,
    },
  },
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
  },
  emits: ["update:modelValue"],
  data() {
    return {
      currentDate: null,
      date: null,
      time: null,
      now: new Date(),
      clockTimer: null,
    }
  },
  watch: {
    modelValue(oldVal, newVal) {
      if (oldVal !== newVal) {
        if (this.modelValue !== null && this.modelValue !== undefined) {
          this.currentDate = new Date(this.modelValue);
        } else {
          this.date = null;
        }
      }
    },
    currentDate() {
      this.parse();
    },
    date(oldVal, newVal) {
      if (oldVal !== newVal) {
        if (this.date === null) {
          this.time = null;
        } else {
          if (this.time === null) {
            this.now = new Date();
            if (!this.dateOnly && this.options.disablePast && this.date === this.today) {
              this.time = this.currentTime;
            } else {
              this.time = "00:00";
            }
          } else {
            this.emitDate();
          }
        }
      }
    },
    time(oldVal, newVal) {
      if (oldVal !== newVal) {
        this.emitDate();
      }
    }
  },
  computed: {
    localeCode() {
      const locale = this.$i18n?.locale;
      return typeof locale === "string" ? locale : locale?.value;
    },
    today() {
      return this.formatLocalDate(this.now);
    },
    currentTime() {
      return this.formatLocalTime(this.now);
    },
  },

  mounted() {
    this.currentDate = this.modelValue
      ? new Date(this.modelValue)
      : null;

    // update the allowed date and time every 30 seconds while the form is open.
    if (this.options.disablePast) {
      this.clockTimer = setInterval(() => {
        this.now = new Date();
      }, 30_000);
    }
  },

  beforeUnmount() {
    if (this.options.disablePast) {
      clearInterval(this.clockTimer);
    }
  },

  methods: {
    /**
     * Format a date as YYYY-MM-DD using the user's local time.
     *
     * @param {Date} value Date to format.
     * @returns {string} Local calendar date.
     */
    formatLocalDate(value) {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, "0");
      const day = String(value.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    },

    /**
     * Format a time as HH:mm using the user's local time (24-hour clock).
     *
     * @param {Date} value Date containing the time.
     * @returns {string} Local time in 24-hour format.
     */
    formatLocalTime(value) {
      const hours = String(value.getHours()).padStart(2, "0");
      const minutes = String(value.getMinutes()).padStart(2, "0");
      return `${hours}:${minutes}`;
    },

    parse() {
      if (this.currentDate !== null) {
        this.date = this.formatLocalDate(this.currentDate);
        if (this.dateOnly) {
          this.time = "00:00";
        } else {
          this.time = this.formatLocalTime(this.currentDate);
        }
      } else {
        this.date = null
        this.time = null
      }
    },
    emitDate() {
      let newDate = null;
      if (this.date !== null) {
        if (this.time !== null) {
          newDate = new Date(`${this.date}T${this.time}`).toISOString();
        } else {
          newDate = new Date(`${this.date}T00:00`).toISOString();
        }
      }
      this.$emit("update:modelValue", newDate);
    },
    /**
     * Validate the visible input using the parent form's shared date rule.
     *
     * @returns {boolean} Whether the input is valid.
     */
    validate() {
      const element = this.$refs.formElement;

      // Read the inputs because currentDate may lag behind a manual edit.
      if (!element.validate(this.date || null)) {
        return false;
      }

      const time = this.dateOnly ? "00:00" : this.time || "00:00";
      const value = this.date ? `${this.date}T${time}` : null;

      // Restricted pickers must be descendants of BasicForm.
      const valid = this.validateDateValue
        ? this.validateDateValue({
            key: this.options.key,
            value,
            disablePast: this.options.disablePast,
            dateOnly: this.dateOnly,
          })
        : !this.options.disablePast;

      element.setInvalid(!valid);
      return valid;
    },
  },
};
</script>

<style scoped>

</style>