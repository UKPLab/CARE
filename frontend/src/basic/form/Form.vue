<template>
  <form>
    <div v-if="currentData !== null" class="row g-3">
      <div v-for="field in fields" :key="field.name" :class="('size' in field)?'col-md-' + field.size :'col-12'">
        <span v-if="field.type === 'switch'"
              class="form-check form-switch">
          <input v-model="currentData[field.name]" class="form-check-input" type="checkbox">
          <label :for="field.name" class="form-label">{{ field.label }}</label>
           <button v-if="'help' in field" :title="field.help" class="btn btn-sm mt-0 pt-0" data-bs-html="true"
                   data-bs-placement="top"
                   data-bs-toggle="tooltip">
              <LoadIcon :size="16" iconName="question-square-fill"></LoadIcon>
           </button>
        </span>
        <span v-else>
            <label v-if="'label' in field" :for="field.name" class="form-label">{{ field.label }}</label>
            <button v-if="'help' in field" :title="field.help" class="btn btn-sm mt-0 pt-0" data-bs-html="true"
                    data-bs-placement="top"
                    data-bs-toggle="tooltip">
              <LoadIcon :size="16" iconName="question-square-fill"></LoadIcon>
            </button>

          <div class="input-group">
          <span v-if="field.type === 'slider'" class="flex-grow-1 text-end">
            {{ currentData[field.name] }}
            <span v-if="'unit' in field"> {{ field.unit }}</span>
          </span>



          <div v-if="'icon' in field" class="input-group-text">
            <LoadIcon :icon-name="field.icon" :size="16"/>
          </div>

        <DatetimePicker v-if="field.type === 'datetime'" v-model="currentData[field.name]" :options="field"/>


           <select v-else-if="field.type === 'select'" v-model="currentData[field.name]" class="form-select">
              <option v-for="option in field.options" :value="option.value">{{ option.name }}</option>
         </select>
            <input v-else-if="field.type === 'slider'" :id="field.name" v-model="currentData[field.name]"
                   :max="field.max"
                   :min="field.min" :step="field.step" class="form-range" type="range">


          <input v-else-if="field.type === 'checkbox'" :id="field.name" v-model="currentData[field.name]"
                 :name="field.name"
                 :required="field.required" :type="field.type" class="form-check-input"/>
            <textarea v-else-if="field.type === 'textarea'" :id="field.name" v-model="currentData[field.name]"
                      :name="field.name"
                      :required="field.required" :type="field.type" class="form-control"/>

          <input v-else
                 :id="field.name"
                 v-model="currentData[field.name]"
                 :class="field.class"
                 :name="field.name"
                 :placeholder="field.placeholder"
                 :required="field.required"
                 :type="field.type"
                 class="form-control"
          >
            </div>
        </span>


      </div>
    </div>
  </form>
</template>

<script>
import LoadIcon from "@/icons/LoadIcon.vue";
import DatetimePicker from "./DatetimePicker.vue";

export default {
  name: "Form",
  components: {LoadIcon, DatetimePicker},
  emits: ["update:modelValue"],
  data() {
    return {
      currentData: null,
    }
  },
  props: {
    modelValue: {
      type: Object,
      required: true
    },
    fields: {
      type: Object,
      required: true
    },
  },
  watch: {
    currentData: {
      handler() {
        this.$emit("update:modelValue", this.currentData);
      }, deep: true
    },
    modelValue: {
      handler() {
        this.currentData = this.modelValue;
      }, deep: true
    }
  },
}
</script>

<style scoped>

</style>