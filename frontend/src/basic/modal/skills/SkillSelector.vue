<template>
  <div class="skill-selector">
    <div class="mb-3">
      <label class="form-label">Select NLP Skill:</label>
      <FormSelect
        :modelValue="modelValue"
        :options="skillOptions"
        @update:modelValue="$emit('update:modelValue', $event)"
      />
    </div>
  </div>
</template>

<script>
import FormSelect from "@/basic/form/Select.vue";

export default {
  name: "SkillSelector",
  components: { FormSelect },
  props: {
    modelValue: {
      type: String,
      default: '',
    },
  },
  emits: ["update:modelValue"],
  computed: {
    nlpSkills() {
      const skills = this.$store.getters["service/get"]("NLPService", "skillUpdate");
      return skills && typeof skills === "object" ? Object.values(skills) : [];
    },
    skillOptions() {
      return {
        options: this.nlpSkills.map((skill) => ({
          value: skill.name,
          name: skill.name,
        })),
      };
    },
  },
};
</script>

<style scoped>
.form-label {
  font-weight: bold;
}
</style>
