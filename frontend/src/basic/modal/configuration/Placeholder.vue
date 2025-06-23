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
          v-model="formData[field.name]"
          :options="skillMap"
          :required="field.required"
          :key="'field-' + field.name + '-' + index"
        />

        <input
          v-else
          type="text"
          class="form-control"
          :id="'field-' + field.name + '-' + index"
          :placeholder="field.placeholder"
          v-model="formData[field.name]"
          :required="field.required"
          :key="'field-' + field.name + '--' + index"
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
      required: true,
      default: () => ({})
    },
    fields: {
      type: Array,
      required: true,
      default: () => []
    },
    index: {
      type: Number,
      required: true,
      default: 0
    },
    formData: {
      type: Object,
      required: true,
      default: () => ({})
    },
    placeholderColor: { 
      type: String,
      required: true,
      default: "#000"
    }
  },
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
