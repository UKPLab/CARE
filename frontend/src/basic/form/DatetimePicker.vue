<template>
  <div class="input-group">
    <input v-model="date" class="form-control " type="date">
    <input v-model="time" class="form-control" type="time">
    <button class="btn btn-outline-secondary" type="button" @click="date = null">Reset</button>
  </div>
</template>

<script>
export default {
  name: "DatetimePicker",
  emits: ["update:modelValue"],
  data() {
    return {
      currentDate: null,
      date: null,
      time: null,
    }
  },
  props: {
    options: {
      type: Object,
      required: true
    },
    modelValue: {
      type: String
    }
  },
  watch: {
    modelValue(oldVal, newVal) {
      if (oldVal !== newVal) {
        if (this.modelValue !== null)
          this.currentDate = new Date(this.modelValue);
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
    if (this.modelValue !== null)
      this.currentDate = new Date(this.modelValue);
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
          newDate = new Date(`${this.date}T${this.time}`).toISOString()
        } else {
          newDate = new Date(`${this.date}T00:00`).toISOString();
        }
      }
      this.$emit("update:modelValue", newDate);
    },
  }
}
</script>

<style scoped>

</style>