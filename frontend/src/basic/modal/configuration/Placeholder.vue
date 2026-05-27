<template>
  <div class="placeholder-container">
    <!-- Placeholder Number with Color -->
    <h6 class="text-secondary mb-3">
      <span :style="{ color: placeholderColor, fontWeight: 'bold' }">
        #{{ index + 1 }}
      </span>
      Add here the information for the placeholder:
    </h6>

    <!-- Input Fields -->
    <div v-if="fields.length">
      <div v-for="field in filteredFields" :key="field.name" class="mb-3">
        <label :for="'field-' + field.name + '-' + index" class="form-label">
          {{ field.label }}
        </label>

        <FormSelect
          v-if="field.name === 'skillName' && nlpSkills.length"
          :key="'field-' + field.name + '-' + index"
          :model-value="formData[field.name]"
          :options="skillMap"
          :required="field.required"
          @update:model-value="onFieldUpdate(field.name, $event)"
        />

        <input
          v-else
          :id="'field-' + field.name + '-' + index"
          :key="'field-' + field.name + '--' + index"
          :value="formData[field.name]"
          type="text"
          class="form-control"
          :placeholder="field.placeholder"
          :required="field.required"
          @input="onFieldUpdate(field.name, $event.target.value)"
        />
      </div>
    </div>
  </div>
</template>

<script>
import FormSelect from "@/basic/form/Select.vue"; // Import FormSelect

/**
 * Placeholder Component for configuration modal
 *
 * @author: Juliane Bechert
 */
export default {
  name: "ConfigurationPlaceholder",
  components: { FormSelect },
  props: {
    placeholder: {
      type: Object,
      required: false,
      default: () => ({})
    },
    fields: {
      type: Array,
      required: false,
      default: () => []
    },
    index: {
      type: Number,
      required: false,
      default: 0
    },
    formData: {
      type: Object,
      required: false,
      default: () => ({})
    },
    placeholderColor: { 
      type: String,
      required: false,
      default: "#000"
    }
  },
  emits: ['update:formData'],
  computed: {
    nlpSkills() {
      const skills = this.$store.getters["service/get"]("NLPService", "skillUpdate");
      return skills && typeof skills === "object" ? Object.values(skills) : [];
    },
    skillMap() {
      return { options: this.nlpSkills.map(skill => ({ value: skill.name, name: skill.name })) };
    },
    filteredFields() {
      return this.fields.filter(field => !(this.hasSkillName && (field.name === 'dataSource' || field.name === 'output')));
    },
    hasSkillName() {
      return this.fields.some(field => field.name === 'skillName');
    }
  },
  methods: {
    onFieldUpdate(key, value) {
      this.$emit('update:formData', { ...this.formData, [key]: value });
    }
  },
};
</script>

<style scoped>
.placeholder-container {
  width: 100%;
  padding: 10px;
  border-bottom: 1px solid #ddd;
}
.form-label {
  font-weight: bold;
}
</style>
