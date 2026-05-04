<template>
  <Modal ref="createModal" lg name="documentCreate">
    <template #title>{{ $t('documents.createNewDocument') }}</template>
    <template #body>
      <div class="modal-body justify-content-center flex-grow-1 d-flex">
        <div class="flex-grow-1">
          <label class="form-label">{{ $t('documents.typeOfDocument') }}</label>
          <select
            v-model="documentType"
            class="form-select form-select-sm selector"
            allowClear="true"
            name="documentType"
          >
            <option disabled hidden selected value="">
              {{ $t('documents.chooseDocumentType') }}
            </option>
            <option value="1">{{ $t('documents.types.generalHtml') }}</option>
            <option value="2">{{ $t('documents.types.studyModal') }}</option>
          </select>
          <div class="invalid-feedback">
            {{ $t('errors.validation.documents.selectValidType') }}
          </div>
          <label class="form-label mt-3">{{ $t('documents.nameOfDocument') }}</label>
          <input v-model="name" class="form-control" name="file" type="text"
                 @keyup.enter="create"/>
          <label class="form-label mt-3">{{ $t('documents.templateOptional') }}</label>
          <select
            v-model="templateId"
            class="form-select form-select-sm"
            name="templateId"
          >
            <option :value="0">{{ $t('documents.noTemplateCreateEmpty') }}</option>
            <option 
              v-for="template in documentTemplates" 
              :key="template.id" 
              :value="template.id"
            >
              {{ template.name }}
            </option>
          </select>
          <small class="text-muted">{{ $t('documents.templatePrefillHint') }}</small>
        </div>
      </div>
    </template>
    <template #footer>
      <div>
        <button class="btn btn-secondary" data-bs-dismiss="modal" type="button">
          {{ $t('common.close') }}
        </button>
        <button class="btn btn-primary" type="button" @click="create"
                @keyup.enter="create">
          {{ $t('common.create') }}
        </button>
      </div>
    </template>
  </Modal>
</template>

<script>
import Modal from "@/basic/Modal.vue";
import { resolveApiMessage } from "@/assets/utils";

/**
 * Document create component
 *
 * This component provides the functionality for creating a document
 * on the server.
 *
 * @author: Dennis Zyska, Juliane Bechert, Zheyu Zhang
 */
export default {
  name: "DocumentCreateModal",
  components: {Modal},
  subscribeTable: ["template"],
  data() {
    return {
      name: "",
      documentType: 1, // Default for General HTML document type
      templateId: 0, // 0 = no template
    };
  },
  computed: {
    selectedProjectId() {
      return this.$store.getters["settings/getValueAsInt"]("projects.default");
    },
    documentTemplates() {
      const currentUserId = this.$store.getters["auth/getUserId"];
      // Own templates only (Type 4 Document - General), including copies
      return this.$store.getters["table/template/getAll"]
        .filter(t => t.type === 4 && !t.deleted && t.userId === currentUserId)
        .map(t => ({
          id: t.id,
          name: t.name
        }));
    }
  },
  methods: {
    open() {
      this.name = "";
      this.documentType = 1; // Reset to default type
      this.templateId = 0; // Reset template selection
      this.$refs.createModal.openModal();
    },
    create() {
      if (this.name.length === 0) {
        this.eventBus.emit("toast", {
          title: this.$t('errors.validation.documents.noName'),
          message: this.$t('errors.validation.documents.enterName'),
          variant: "danger",
        });
        return;
      }

      this.$refs.createModal.waiting = true;

      const createData = {
        type: this.documentType,
        name: this.name,
        projectId: this.selectedProjectId,
        templateId: this.templateId,
      };

      this.$socket.emit("documentCreate", createData, (res) => {
        if (res.success) {
          this.$refs.createModal.close();
          this.eventBus.emit("toast", {
            message: this.$t('documents.messages.documentCreated'),
            title: this.$t('common.success'),
            variant: "success",
          });
        } else {
          this.$refs.createModal.waiting = false;
          this.eventBus.emit("toast", {
            message: resolveApiMessage(res),
            title: this.$t('common.error'),
            variant: "danger",
          });
        }
      });
    },
  },
};
</script>
