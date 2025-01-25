<template>
  <BasicModal ref="configurationModal" lg name="configurationModal">
    <template #title>
      <h5 class="modal-title text-primary">Configure NLP Placeholders</h5>
    </template>
    <template #body>
      <div v-if="placeholders.length">
        <h6 class="text-secondary mb-3">Preview of the document:</h6>
        <div v-for="(placeholder, index) in placeholders" :key="index" class="mb-4">
          <!-- Preview Before -->
          <p class="mb-2">
            <span class="text-dark">
              {{ placeholder.previewBefore.length > 100 ? placeholder.previewBefore.slice(0, 100) + '...' : placeholder.previewBefore}}
            </span>
          </p>
          <h6 class="text-secondary mb-3">Add here the information for the placeholder:</h6>
          <!-- Input Fields -->
          <div v-if="data?.fields?.[0]?.fields">
            <div
              v-for="field in data.fields[0].fields"
              :key="field.name"
              class="mb-3"
            >
              <label :for="'field-' + field.name + '-' + index" class="form-label">
                {{ field.label }}
              </label>
              <input
                type="text"
                class="form-control"
                :id="'field-' + field.name + '-' + index"
                :placeholder="field.placeholder"
                v-model="formData[index][field.name]"
                :required="field.required"
              />
            </div>
          </div>

          <!-- Preview After -->
          <p class="mt-2">
            <span class="text-dark">
              {{ placeholder.previewAfter.length > 100 ? placeholder.previewAfter.slice(0, 100) + '...' : placeholder.previewAfter }}
            </span>
          </p>
        </div>
      </div>
      <div v-else>
        <p>No placeholders found in the document.</p>
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
    placeholders: [],
    formData: [], 
    studyStepId: null,
    };
},
methods: {
  open(configuration, studyStepId, documentId) {
    this.studyStepId = studyStepId;
    const requestData = { documentId, studyStepId, studySessionId: this.studySessionId || null };

    this.$socket.emit("documentGet", requestData, (response) => {
      if (response.success) {
        const { deltas } = response.data || {};
        if (deltas?.ops) {
          this.placeholders = this.extractPlaceholders(deltas);
          if (configuration?.fields?.[0]?.fields) {
            this.formData = this.placeholders.map(() => {
              const fieldData = {};
              configuration.fields[0].fields.forEach((field) => {
                fieldData[field.name] = ""; 
              });
              return fieldData;
            });
          } else {
            this.formData = [];
            console.warn("No fields configuration found for placeholders.");
          }

          this.data = configuration || { fields: [] };

          this.$refs.configurationModal.open();
        } else {
          console.error("Invalid document content:", response);
          this.eventBus.emit("toast", {
            title: "Document Error",
            message: "The document content is invalid or empty. Please try again.",
            variant: "danger",
          });
        }
      } else {
        console.error("Failed to fetch document content:", response);
        this.eventBus.emit("toast", {
          title: "Document Error",
          message: response.message || "Failed to fetch the document.",
          variant: "danger",
        });
      }
    });
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
    extractPlaceholders(document) {
      const content = document.ops.map((op) => op.insert).join("");
 
      // Use regex to match the placeholder
      const regex = /~nlp\[d\+\]~/g; // Adjusted regex to match "~nlp[d+]~"
      const results = [];
      let match;

      while ((match = regex.exec(content)) !== null) {
        const index = match.index;
        const text = match[0];

        // Get all text before the placeholder
        const fullBeforeText = content.slice(0, index).trim();
        const previewBefore = fullBeforeText.length > 100
          ? fullBeforeText.slice(0, 100) + "..."
          : fullBeforeText;

        // Get all text after the placeholder
        const fullAfterText = content.slice(index + text.length).trim();
        const previewAfter = fullAfterText.length > 100
          ? fullAfterText.slice(0, 100) + "..."
          : fullAfterText;

        results.push({ text, previewBefore, previewAfter });
      }

      return results;
    }
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

.text-primary {
  color: #007bff !important;
}

.text-secondary {
  color: #6c757d !important;
}

.text-dark {
  color: #343a40 !important;
}

.text-muted {
  color: #6c757d !important;
}
</style>
