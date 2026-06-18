<template>
  <div class="skill-selector">
    <div class="mb-3">
      <label class="form-label">Select Skill:</label>
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
 * Skill Selector Component for selecting an NLP skill or an AI hook.
 * NLP skills come from the NLPService store; AI hooks from the ai_hook table. Hooks are encoded
 * as `hook:<id>` so the parent can tell them apart from skill names.
 *
 * @author Manu Sundar Raj Nandyal
 */
import FormSelect from "@/basic/form/Select.vue";

export default {
  name: "SkillSelector",
  components: { FormSelect },
  subscribeTable: ["ai_hook"],
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
    hooks() {
      const all = this.$store.getters["table/ai_hook/getAll"] || [];
      return all.filter((hook) => hook.enabled && !hook.deleted);
    },
    skillOptions() {
      const skillOpts = this.nlpSkills.map((skill) => ({
        value: skill.name,
        name: `Skill: ${skill.name}`,
      }));
      const hookOpts = this.hooks.map((hook) => ({
        value: `hook:${hook.id}`,
        name: `Hook: ${hook.name}`,
      }));
      return { options: [...skillOpts, ...hookOpts] };
    },
  },
};
</script>

<style scoped>
.form-label {
  font-weight: bold;
}
</style>
