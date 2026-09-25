
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
        v-model="time"
        class="form-control"
        type="time"
        :lang="localeCode"
        :min="options.disablePast && date === today ? currentTime : undefined"
        @blur="validate"
      >
      <button
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
  props: {
    options: {
      type: Object,
      required: true
    },
    modelValue: {
      type: [String, null],
      required: true
    }
  },
  emits: ["update:modelValue"],
  data() {
    return {
      currentDate: null,
      date: null,
      time: null,
      originalValue: null,
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
            this.time = "00:00";
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
    this.originalValue = this.modelValue;
    this.currentDate = this.modelValue ? new Date(this.modelValue) : null;

    // update the allowed date and time every 30 seconds while the form is open.
    this.clockTimer = setInterval(() => {
      this.now = new Date();
    }, 30_000);

  },

  beforeUnmount() {
    clearInterval(this.clockTimer);
  },

  methods: {
    formatLocalDate(value) {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, "0");
      const day = String(value.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    },

    formatLocalTime(value) {
      const hours = String(value.getHours()).padStart(2, "0");
      const minutes = String(value.getMinutes()).padStart(2, "0");
      return `${hours}:${minutes}`;
    },

    parse() {
      if (this.currentDate !== null) {
        const day = ("0" + this.currentDate.getDate()).slice(-2);
        const month = ("0" + (this.currentDate.getMonth() + 1)).slice(-2);
        this.date = this.currentDate.getFullYear() + "-" + (month) + "-" + (day);
        const hours = ("0" + this.currentDate.getHours()).slice(-2);
        const minutes = ("0" + this.currentDate.getMinutes()).slice(-2);
        this.time = hours + ":" + minutes;
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
    validate() {
      const element = this.$refs.formElement;

      // use the input value as currentDate can lag behind a manual edit.
      if (!element.validate(this.date || null)) return false;

      if (!this.options.disablePast || !this.date) {
        element.invalidField = false;
        return true;
      }

      const selected = new Date(`${this.date}T${this.time || "00:00"}`);
      const original = this.originalValue
        ? new Date(this.originalValue)
        : null;

      const unchangedExistingValue =
        original &&
        !Number.isNaN(original.getTime()) &&
        this.date === this.formatLocalDate(original) &&
        this.time === this.formatLocalTime(original);

      // inputs have minute precision, so permit the current minute.
      const currentMinute = new Date();
      currentMinute.setSeconds(0, 0);

      const valid =
        !Number.isNaN(selected.getTime()) &&
        (selected >= currentMinute || unchangedExistingValue);

      element.invalidField = !valid;
      if (!valid) element.shakeIt();

      return valid;
    },
  },
};
</script>

<style scoped>

</style>