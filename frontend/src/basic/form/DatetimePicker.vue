<template>
  <div class="input-group">
    <input ref="date" v-model="date" class="form-control " type="date">
    <input ref="time" v-model="time" class="form-control" type="time">
    <button class="btn btn-outline-secondary" type="button" @click="reset">Reset</button>
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
      type: String,
      required: true
    }
  },
  watch: {
    modelValue() {
      if (this.modelValue !== null)
        this.currentDate = new Date(this.modelValue);
    },
    currentDate() {
      this.parse();
    },
    date() {
       this.emitDate();
    },
    time() {
       this.emitDate();
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
        this.time = this.currentDate.getHours() + ":" + this.currentDate.getMinutes();
      } else {
        this.date = null
        this.time = null
      }
    },
    emitDate() {
      let newDate = null;
      if (this.$refs.date.value !== null && this.$refs.date.value !== "") {
        if (this.$refs.time.value !== null && this.$refs.time.value !== "") {
          newDate = new Date(`${this.$refs.date.value}T${this.$refs.time.value}`).toISOString();
        } else {
          newDate = new Date(`${this.$refs.date.value}T00:00`).toISOString();
        }
      }
      this.$emit("update:modelValue", newDate);
    },
    reset() {
      this.currentDate = null;
      this.$emit("update:modelValue", null);
    }
  }
}
</script>

<style scoped>

</style>