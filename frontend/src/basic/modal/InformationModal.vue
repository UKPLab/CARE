<template>
  <BasicModal
    ref="informationModal"
    lg
    name="informationModal"
  >
    <template #title>
      <h5 class="modal-title text-primary">Details</h5>
    </template>
    <template #body>
      <div class="information-container p-3">
        <dl v-for="(value, key) in this.data" :key="key" class="row align-items-center">
          <dt class="col-sm-4 fw-bold text-secondary">{{ formatKey(key) }}</dt>
          <dd class="col-sm-8">
            <template v-if="isObject(value)">
              <ul class="list-unstyled ps-3">
                <li
                  v-for="(subValue, subKey) in value"
                  :key="subKey"
                  class="mb-1"
                >
                  <span class="fw-semibold text-dark">{{ formatKey(subKey) }}:</span>
                  <span class="text-muted">{{ subValue }}</span>
                </li>
              </ul>
            </template>
            <template v-else>
              <span class="text-muted">{{ transformValue(value) }}</span>
            </template>
          </dd>
        </dl>
      </div>
    </template>
    <template #footer>
      <div class="d-flex justify-content-end">
        <BasicButton class="btn btn-outline-secondary" @click="close" title="Close" />
      </div>
    </template>
  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicButton from "@/basic/Button.vue";

/**
 * Providing information from the database
 *
 * Modal including the details of an existing datatable
 *
 * @author: Juliane Bechert
 */
export default {
  name: "InformationModal",
  components: { BasicButton, BasicModal },
  data() {
    return {
      data: {},
    };
  },
  methods: {
    open(data) {
      this.data = data;
      this.$refs.informationModal.open();
    },
    close() {
      this.$refs.informationModal.close();
    },
    formatKey(key) {
      return key
        .replace(/([A-Z])/g, " $1")
        .replace(/_/g, " ")
        .replace(/^\w/, (c) => c.toUpperCase());
    },
    isObject(value) {
      return value && typeof value === "object" && !Array.isArray(value);
    },
    transformValue(value) {
      if (value === null) {
        return "Not yet set";
      }
      if (typeof value === "string" && value.startsWith("<p>")) {
        const parser = new DOMParser();
        return parser.parseFromString(value, "text/html").body.textContent || "";
      }
      return value;
    },
  },
};
</script>

<style scoped>
.information-container {
  max-height: 400px;
  overflow-y: auto;
  background: #f8f9fa;
  border-radius: 0.5rem;
}

.row {
  margin-bottom: 1rem;
}

.modal-title {
  font-weight: bold;
  text-transform: uppercase;
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

.fw-bold {
  font-weight: 700 !important;
}

.fw-semibold {
  font-weight: 600 !important;
}

.btn-outline-secondary {
  transition: all 0.3s ease;
}

.btn-outline-secondary:hover {
  background-color: #6c757d;
  color: #fff;
}
</style>


