<template>
      <div class="services-step">
        <!-- Services Configuration Content -->
        <div v-if="hasConfigServices" class="services-config mb-4">
          <h6 class="section-title">Available Services</h6>

          <div
            v-for="(skill, index) in selectedSkills"
            :key="index"
            class="skill-item mb-3"
          >
            <div class="skill-selection mb-2">
              <SkillSelector
                v-model="skill.skillName"
              />
            </div>
            <!-- Input Mappings for Selected Skill -->
            <InputMap
              v-if="skill.skillName"
              :skill-name="skill.skillName"
              :study-based="true"
              :model-value="modelValue.services[index]?.inputs || {}"
              :study-step-id="studyStepId"
              :workflow-steps="workflowSteps"
              :current-stepper-step="currentStepperStep"
              :step-config="modelValue"
              :selected-skills="selectedSkills"
              :document-id="documentId"
              @update:model-value="handleInputMappingUpdate(index, $event)"
            />
          </div>
        </div>

        <!-- No Services Message -->
        <div v-else class="no-content">
          <div class="alert alert-info" role="alert">
            No services configuration available for this step.
          </div>
        </div>
      </div>
</template>

<script>
import StepTemplate from "@/basic/modal/StepTemplate.vue";
import SkillSelector from "@/basic/modal/skills/SkillSelector.vue";
import InputMap from "@/basic/modal/skills/InputMap.vue";

/**
 * ServicesStep Component
 *
 * A component that handles NLP services configuration including
 * skill selection and input mapping for workflow steps.
 */
export default {
  name: "ServicesStep",
  components: {
    StepTemplate,
    SkillSelector,
    InputMap,
  },
  props: {
    modelValue: {
      type: Object,
      required: true,
    },
    currentStepperStep: {
      type: Number,
      required: true,
    },
  },
  inject: {
    studyStepId: {
      type: Number,
      required: true,
    },
    documentId: {
      type: Number,
      required: false,
      default: null,
    },
    workflowSteps: {
      type: Array,
      required: true,
    },
  },
  data() {
    return {
      selectedSkills: this.modelValue.services.map((service) => {
          // Handle update case
          if (service.skill) {
            return {
              skillName: service.skill,
              dataInput: service.inputs || {},
            };
          }
          // Handle create case
          return {
            skillName: "",
            dataInput: {},
          };
        })
    };
  },
  emits: ["update:form-data", "validation-change"],
  computed: {

    hasConfigServices() {
      return !!(
        this.modelValue &&
        Array.isArray(this.modelValue.services) &&
        this.modelValue.services.length
      );
    },
    isValid() {
      return this.selectedSkills.every(skill => skill.skillName !== "");
    },

    inputMappings() {
      return this.selectedSkills?.map((skill, idx) => {
        const mapping = {};
        if (skill.skillName) {
          const inputs = this.getSkillInputs(skill.skillName);
          inputs.forEach((input) => {
            mapping[input] = this.getFormattedDataInput(idx, input);
          });
        }
        return mapping;
      });
    },
  },
  watch: {
    isValid: {
      handler(newVal) {
        this.$emit("validation-change", newVal);
      },
      immediate: true,
    },

  },
  methods: {
    updateSkillName(index, skillName) {     
      const updatedSkills = [...this.selectedSkills];
      updatedSkills[index] = {
        ...updatedSkills[index],
        skillName,
        dataInput: {}, // Reset input mappings when skill changes
      };
      this.selectedSkills = updatedSkills;

      // Clear the input mappings for this skill since it changed
      this.updateInputMappingsForSkill(index, skillName);

      // Emit the properly formatted data for the parent
      const updatedFormData = updatedSkills.map((skill, skillIndex) => ({
        name: this.modelValue.services[skillIndex]?.name || "",
        type: this.modelValue.services[skillIndex]?.type || "",
        skill: skill.skillName,
        inputs: skill.dataInput,
      }));

      this.$emit("update:form-data", updatedFormData);
    },
    getFormattedDataInput(skillIndex, inputKey) {
      const skill = this.selectedSkills[skillIndex];
      if (
        skill &&
        skill.dataInput &&
        skill.dataInput[inputKey]
      ) {
        const input = skill.dataInput[inputKey];
        return {
          stepId: input.stepId,
          value: input.dataSource,
        };
      }
      return null;
    },

    handleInputMappingUpdate(skillIndex, mappingData) {
      
      // Update the selectedSkills dataInput based on the new mapping
      const updatedSkills = [...this.selectedSkills];
      if (!updatedSkills[skillIndex]) {
        updatedSkills[skillIndex] = { skillName: '', dataInput: {} };
      }
      
      // Convert mapping data to the expected format
      const dataInput = {};
      Object.entries(mappingData).forEach(([input, source]) => {
        if (source && source.value) {
          dataInput[input] = {
            value: parseInt(source.value, 10),
            stepId: source.stepId,
            name: source.name,
            dataSource: source.value,
          };
        }
      });
      
      updatedSkills[skillIndex].dataInput = dataInput;
      //this.selectedSkills = updatedSkills;
      // Emit the properly formatted data for the parent
      const updatedFormData = updatedSkills.map((skill, index) => ({
        name: this.modelValue.services[index]?.name || "",
        type: this.modelValue.services[index]?.type || "",
        skill: skill.skillName,
        inputs: skill.dataInput,
      }));
      this.$emit("update:form-data", updatedFormData);
    },

    updateInputMappingsForSkill(index, skillName) {
      const updatedMappings = [...this.inputMappings];
      const mapping = {};

      if (skillName) {
        const inputs = this.getSkillInputs(skillName);
        inputs.forEach((input) => {
          mapping[input] = null;
        });
      }

      updatedMappings[index] = mapping;
    },

    getSkillInputs(skillName) {
      // Find the skill in the skills list
      const skills = this.$store.getters["service/get"]("NLPService", "skillUpdate");
      const nlpSkills = skills && typeof skills === "object" ? Object.values(skills) : [];
      
      const skill = nlpSkills.find((s) => s.name === skillName);
      if (!skill) return [];
      
      // Return the input keys (v1, v2, etc.)
      return Object.keys(skill.config?.input?.data || {});
    },




  },
};
</script>

<style scoped>
.services-step {
  padding: 1rem;
}

.section-title {
  color: #495057;
  font-weight: 600;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #dee2e6;
}

.services-config {
  background-color: #f8f9fa;
  padding: 1rem;
  border-radius: 0.5rem;
  border: 1px solid #e9ecef;
}

.skill-item {
  background-color: #ffffff;
  padding: 1rem;
  border-radius: 0.5rem;
  border: 1px solid #e9ecef;
}

.skill-selection {
  background-color: #f8f9fa;
  padding: 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid #e9ecef;
}

.input-mappings {
  background-color: #f1f3f4;
  padding: 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid #e9ecef;
}

.input-title {
  color: #495057;
  font-weight: 600;
  margin-bottom: 0.75rem;
  font-size: 0.9rem;
}

.input-mapping {
  background-color: #ffffff;
  padding: 0.5rem;
  border-radius: 0.25rem;
  border: 1px solid #dee2e6;
}

.form-label {
  font-weight: 500;
  color: #495057;
  margin-bottom: 0.5rem;
}

.form-control {
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}

.form-control:focus {
  border-color: #0d6efd;
  box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
}

.no-content {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

.alert {
  border: none;
  border-radius: 0.5rem;
}
</style>
