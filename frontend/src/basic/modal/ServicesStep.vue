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
              <label class="form-label">Select Skill:</label>
              <select
                :value="skill.skillName"
                @change="updateSkillName(index, $event.target.value)"
                class="form-control"
              >
                <option value="">Select a skill...</option>
                <option
                  v-for="option in skillMap.options"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.name }}
                </option>
              </select>
            </div>

            <!-- Input Mappings for Selected Skill -->
            <div v-if="skill.skillName" class="input-mappings">
              <h6 class="input-title">Input Mappings:</h6>
              <div
                v-for="input in getSkillInputs(skill.skillName)"
                :key="input"
                class="input-mapping mb-2"
              >
                <label class="form-label">{{ input }}:</label>
                <select
                  :value="getFormattedDataInput(index, input)?.value || ''"
                  @change="
                    handleInputMappingChange(index, input, $event.target.value)
                  "
                  class="form-control"
                >
                  <option value="">Select data source...</option>
                  <option
                    v-for="source in availableDataSources"
                    :key="`${source.stepId}-${source.value}`"
                    :value="source.value"
                    :data-step-id="source.stepId"
                  >
                    {{ source.name }}
                  </option>
                </select>
              </div>
            </div>
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
  },
  props: {
    modelValue: {
      type: Object,
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
    availableDataSources() {
      return this.getSourcesUpToCurrentStep(this.studyStepId);
    },
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
    nlpSkills() {
      const skills = this.$store.getters["service/get"](
        "NLPService",
        "skillUpdate"
      );
      return skills && typeof skills === "object" ? Object.values(skills) : [];
    },
    skillMap() {
      return {
        options: this.nlpSkills.map((skill) => ({
          value: skill.name,
          name: skill.name,
        })),
      };
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
    selectedSkills: {
      handler(newVal) {
        const updatedFormData = newVal.map((service, index) => ({
            name: this.modelValue.services[index]?.name || "",
            type: this.modelValue.services[index]?.type || "",
            skill: newVal[index]?.skillName,
            inputs: newVal[index]?.dataInput,
          }));

        this.$emit("update:form-data", updatedFormData);
      },
      deep: true,
    },
  },
  methods: {
    updateSkillName(index, skillName) {
      const updatedSkills = [...this.selectedSkills];
      updatedSkills[index] = {
        ...updatedSkills[index],
        skillName,
        dataInput: {},
      };
      this.selectedSkills = updatedSkills;

      // Update input mappings
      this.updateInputMappingsForSkill(index, skillName);
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

    handleInputMappingChange(skillIndex, input, sourceValue) {
      if (!sourceValue) return;

      const source = this.availableDataSources.find(
        (src) => src.value === sourceValue
      );
      if (!source) return;

      this.updateDataInput(skillIndex, input, source);
    },

    updateDataInput(index, input, source) {
      if (!source) return;

      const updatedSkills = JSON.parse(JSON.stringify(this.selectedSkills));

      if (!updatedSkills[index].dataInput) {
        updatedSkills[index].dataInput = {};
      }

      updatedSkills[index].dataInput[input] = {
        stepId: source.stepId,
        dataSource: source.value,
      };

      this.selectedSkills = updatedSkills;
    },

    getFormattedDataInput(index, input) {
      const dataInput = this.selectedSkills[index]?.dataInput?.[input];
      if (!dataInput) return null;

      return this.availableDataSources.find(
        (source) =>
          source.stepId === dataInput.stepId &&
          source.value === dataInput.dataSource
      );
    },

    getSkillInputs(skillName) {
      // Find the skill in the skills list
      const skill = this.nlpSkills.find((s) => s.name === skillName);
      if (!skill) return [];
      // Return the input keys (v1, v2, etc.)
      return Object.keys(skill.config?.input?.data || {});
    },

    /**
     * Construct and get all the available data sources up to the stepId
     * @param {number} stepId - The ID of the workflow step
     * @returns {Array<Object>} An array of data source object, consisting of value and name
     */
    getSourcesUpToCurrentStep(stepId) {
      const sources = [];
      const stepCollector = this.workflowSteps.filter((step) => step.id <= stepId);

      stepCollector.forEach((step, index) => {
        const stepIndex = index + 1;
        switch (step.stepType) {
          // Editor
          case 2:
            sources.push(
              { value: "firstVersion", name: `First Version (Step ${stepIndex})`, stepId: stepIndex },
              { value: "currentVersion", name: `Current Version (Step ${stepIndex})`, stepId: stepIndex }
            );
            break;
          // Modal
          case 3:
            if (step.id < this.studyStepId) {
              sources.push(...this.getSkillSources(stepIndex));
            }
            break;
        }
      });

      return sources;
    },

    /**
     * Get the output from the nlpSkill
     * @param {number} stepIndex - The index of the step that indicates which step the user is at in the whole workflow.
     * @returns {Array<Object>} An array of objects derived from nlpSkill
     */
    getSkillSources(stepIndex) {
      const sources = [];

      if (!this.selectedSkills.length) return sources;

      // Get the services from modelValue
      const services = this.modelValue.services || [];

      services.forEach((service) => {
        this.selectedSkills.forEach(({ skillName }) => {
          if (!skillName) return;

          const skill = this.nlpSkills.find((s) => s.name === skillName);
          if (!skill || !skill.config || !skill.config.output || !skill.config.output.data) return;

          const result = Object.keys(skill.config.output.data || {});
          result.forEach((r) =>
            sources.push({
              value: `service_${service.name}_${r}`,
              name: `${skillName}_${r} (Step ${stepIndex})`,
              stepId: stepIndex,
            })
          );
        });
      });

      return sources;
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
