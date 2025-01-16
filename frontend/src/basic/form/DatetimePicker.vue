-
<template>
  <FormElement ref="formElement" :options="options">
    <template #element="{blur}">
      <input
          v-model="date"
          class="form-control"
          type="date"
          @blur="blur(currentDate)"
      >
      <input
          v-model="time"
          class="form-control"
          type="time"
          @blur="blur(currentDate)"
      >
      <button
          class="btn btn-outline-secondary"
          type="button"
          @click="date = null"
      >
        Reset
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
  mounted() {
    if (this.modelValue && this.modelValue !== undefined) {
      this.currentDate = new Date(this.modelValue);
    } else {
      this.currentDate = null;
    }
  },
  methods: {
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
      return this.$refs.formElement.validate(this.currentDate);
    }
  }
}
</script>

<style scoped>

</style>