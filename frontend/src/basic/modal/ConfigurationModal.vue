<template>
    <BasicModal ref="configurationModal" lg name="configurationModal">
        <template #title>
        <h5 class="modal-title text-primary">Configure NLP Placeholders</h5>
        </template>
        <template #body>
        <div v-if="data.fields && data.fields.length">
            <div
            v-for="(placeholder, index) in data.fields"
            :key="index"
            class="mb-4"
            >
            <h6 class="text-secondary">Placeholder {{ index + 1 }}</h6>
            <div
                v-for="(field, fieldIndex) in placeholder.fields"
                :key="fieldIndex"
                class="mb-3"
            >
                <label :for="'field-' + index + '-' + fieldIndex" class="form-label">
                {{ field.label }}
                </label>
                <input
                type="text"
                class="form-control"
                :id="'field-' + index + '-' + fieldIndex"
                :placeholder="field.placeholder"
                v-model="formData[index][field.name]"
                :required="field.required"
                />
            </div>
            </div>
        </div>
        <div v-else>
            <p>No placeholders found in the configuration.</p>
        </div>
        </template>
        <template #footer>
        <button class="btn btn-primary" @click="submit">Submit</button>
        <button class="btn btn-secondary" @click="close">Close</button>
        </template>
    </BasicModal>
</template>
  
  
<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";

/**
 * Configuration Modal for User Input
 *
 * This modal dynamically renders input fields based on the provided configuration.
 * It supports placeholders for NLP models, links, and other custom fields.
 * Users can provide data that will be processed and stored as part of the workflow configuration.
 *
 * @author: Juliane Bechert
 */
export default {
name: "ConfigurationModal",
components: { BasicModal, BasicButton },
data() {
    return {
    data: {
        fields: [],
    },
    formData: [], 
    studyStepId: null,
    };
},
methods: {
    open(configuration, studyStepId) {
    this.data = configuration;
    this.formData = configuration.fields.map(() => ({}));
    this.studyStepId = studyStepId;
    this.$refs.configurationModal.open();
    },
    close() {
    this.$refs.configurationModal.close();
    },
    submit() {
      if (this.validateForm()) {
        const configData = {
        studyStepId: this.studyStepId,
        configuration: this.formData,
        };

        this.$emit("updateConfiguration", configData);

        this.$refs.configurationModal.close();
        this.eventBus.emit("toast", {
        title: "Configuration Updated",
        message: "The configuration data has been successfully updated.",
        variant: "success",
        });
      }
    },
    validateForm() {
      let isValid = true;
      this.data.fields.forEach((placeholder, index) => {
        placeholder.fields.forEach((field) => {
          if (field.required && !this.formData[index][field.name]) {
            isValid = false;
            this.eventBus.emit("toast", {
              title: "Validation Error",
              message: `${field.label} is required.`,
              variant: "danger",
            });
          }
        });
      });
      return isValid;
    },
  },
};
</script>

<style scoped>
.configuration-container {
max-height: 400px;
overflow-y: auto;
background: #f8f9fa;
border-radius: 0.5rem;
}

.form-label {
font-weight: bold;
}

.text-primary {
color: #007bff !important;
}

.text-secondary {
color: #6c757d !important;
}

.text-muted {
color: #6c757d !important;
}

.btn-outline-secondary {
transition: all 0.3s ease;
}

.btn-outline-secondary:hover {
background-color: #6c757d;
color: #fff;
}
</style>
