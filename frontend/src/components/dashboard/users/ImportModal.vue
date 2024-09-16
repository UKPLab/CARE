<template>
  <BasicModal
    ref="modal"
    @hide="resetForm"
  >
    <template #title>
      <span>Bulk Import Users</span>
    </template>
    <template #body>
      <!-- Stepper -->
      <div class="stepper">
        <div
          v-for="(step, index) in steps"
          :key="index"
          :class="{ active: currentStep === index }"
        >
         {{ step.title }}
        </div>
      </div>
      <!-- Content -->
      <div class="content-container">
        <!-- Step1: Upload -->
        <div
          v-if="currentStep === 0"
          class="file-upload-container"
        >
          <div
            class="drag-drop-area"
            @dragover.prevent
            @drop.prevent="handleDrop"
            @click="$refs.fileInput.click()"
          >
            <input
              ref="fileInput"
              type="file"
              accept=".csv"
              style="display: none"
              @change="handleFileUpload"
            />
            <BasicIcon
              icon-name="cloud-arrow-up"
              size="64"
            />
            <p>Drag and drop CSV file here<br />or click to upload</p>
          </div>
          <p>Please check the format or <a href="">download the template</a> here.</p>
          <div
            v-if="file && file.name !== ''"
            class="file-info-container"
          >
            <div class="file-info">
              <BasicIcon
                icon-name="file-earmark"
                size="20"
              />
              <strong>{{ file.name }}</strong>
              <span>({{ file.size }} KB)</span>
            </div>
            <button @click="clearFile">
              <BasicIcon
                icon-name="x-circle-fill"
                size="20"
              />
            </button>
          </div>
        </div>
        <!-- Step2:  -->
        <!-- Step3:  -->
        <!-- Step4:  -->
      </div>
    </template>
    <template #footer>
      <BasicButton
        title="Previous"
        class="btn btn-secondary"
        @click="prevStep"
      />
      <BasicButton
        title="Next"
        class="btn btn-primary"
        @click="nextStep"
      />
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";
import BasicIcon from "@/basic/Icon.vue";

/**
 * Modal for bulk creating users through csv file
 * @author: Linyin Huang
 */
export default {
  name: "ImportModal",
  components: { BasicModal, BasicButton, BasicIcon },
  props: {
    steps: {
      type: Array,
      default: () => [{ title: "Upload" }, { title: "Preview" }, { title: "Confirm" }, { title: "Result" }],
    },
  },
  data() {
    return {
      currentStep: 0,
      file: {
        name: "",
        size: 0,
      },
    };
  },
  methods: {
    open() {
      this.$refs.modal.open();
    },
    resetForm() {
      this.$refs.form.modelValue.password = "";
      this.eventBus.emit("resetFormField");
    },
    nextStep() {
      if (this.currentStep < 3) {
        this.currentStep++;
      }
    },
    prevStep() {
      if (this.currentStep > 0) {
        this.currentStep--;
      }
    },
    handleDrop(event) {
      const file = event.dataTransfer.files[0];
      this.processFile(file);
    },
    handleFileUpload(event) {
      const file = event.target.files[0];
      this.processFile(file);
    },
    processFile(file) {
      if (file && file.name.endsWith(".csv")) {
        this.file = {
          name: file.name,
          size: file.size,
        };

        this.uploadFile(file);
      } else {
        alert("Please upload a CSV file");
      }
    },
    clearFile() {
      this.file = {
        name: "",
        size: 0,
      };
      this.$refs.fileInput.value = "";
    },
    uploadFile(file) {
      // file
    },
  },
};
</script>

<style scoped>
/* Stepper */
.stepper {
  display: flex;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}

.stepper div {
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.stepper div.active {
  --btn-color: #0d6efd;
  background-color: var(--btn-color);
  color: white;
  border-color: var(--btn-color);
}
.file-upload-container {
  width: 100%;
  max-width: 500px;
  margin: 0 auto;
}

.drag-drop-area {
  margin-bottom: 0.5rem;
  border: 2px dashed #ccc;
  border-radius: 4px;
  padding: 1.25rem;
  text-align: center;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.drag-drop-area:hover {
  background-color: #f0f0f0;
}

.drag-drop-area p {
  margin: 0;
  font-size: 0.925rem;
  color: #666;
}

.file-info-container {
  margin-top: 0.9375rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid #dee2e6;
  background: #f2f2f2;
  border-radius: 4px;
}

.file-info {
  margin-left: 0.5rem;
  font-size: 0.925rem;
}

.file-info-container strong {
  margin: 0 0.5rem;
  color: #333;
}

.file-info-container button {
  background-color: transparent;
  color: firebrick;
  border: none;
  padding: 5px 10px;
  cursor: pointer;
}
</style>
