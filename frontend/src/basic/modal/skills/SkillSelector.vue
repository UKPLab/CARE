<template>
  <div class="skill-selector">
    <div class="mb-3">
      <label class="form-label">{{ $t('nlp.skillSelector.selectNlpSkill') }}</label>
      <FormSelect
        :model-value="modelValue"
        :options="skillOptions"
        @update:model-value="$emit('update:modelValue', $event)"
      />
    </div>
  </div>
</template>

<script>
/**
 * Skill Selector Component for selecting NLP skills
 * Fetches available skills from the store and presents them for selection
 * 
 * @author Manu Sundar Raj Nandyal
 */
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
          name: this.getSkillDisplayName(skill.name),
        })),
      };
    },
  },
  methods: {
    getSkillDisplayName(skillName) {
      const key = `nlp.skills.names.${skillName}`;
      return this.$te(key) ? this.$t(key) : skillName;
    },
  },
};
</script>

<style scoped>
.form-label {
  font-weight: bold;
}
</style>
