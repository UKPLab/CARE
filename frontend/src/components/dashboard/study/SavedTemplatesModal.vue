<template>
  <span>
  <StudyModal ref="studyCoordinator"/>
  <BasicModal
    ref="savedTemplatesModal"
    name="savedTemplatesModal"
    size="lg"
  >
    <template #title>
      <h5 class="modal-title">Saved Templates</h5>
    </template>
    <template #body>
      <BasicTable
        :columns="columns"
        :data="savedTemplates"
        :options="tableOptions"
        :buttons="tableButtons"
        @action="handleAction"
      />
    </template>
    <template #footer>
      <BasicButton
        class="btn btn-secondary"
        title="Close"
        @click="close"
      />
      
    </template>
  </BasicModal>
</span>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";
import StudyModal from "@/components/dashboard/coordinator/Study.vue";
/**
 * Modal to show saved study templates
 * 
 * This modal allows users to view, use, and delete saved study templates.
 * Users can browse through their saved templates, delete unwanted ones,
 * and use existing templates to create new studies with pre-configured settings.
 * 
 * @author: Karim Ouf
 */
export default {
  name: "SavedTemplatesModal",
  components: { BasicModal, BasicTable, BasicButton, StudyModal },
  data() {
    return {
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 10,
        search: true,
      },
      columns: [
        { name: "Name", key: "name" },
        { name: "Created At", key: "createdAt", sortable: true },
        {
          name: "Resumable",
          key: "resumable",
          type: "badge",
          typeOptions: {
            keyMapping: {true: "Yes", false: "No"},
            classMapping: {true: "bg-success", false: "bg-danger"}
          }
        },
        {
          name: "Collaborative",
          key: "collab",
          type: "badge",
          typeOptions: {
            keyMapping: {true: "Yes", false: "No"},
            classMapping: {true: "bg-success", false: "bg-danger"}
          }
        },
        {
          name: "Multiple Submissions",
          key: "multipleSubmit",
          type: "badge",
          typeOptions: {
            keyMapping: {true: "Yes", false: "No"},
            classMapping: {true: "bg-success", false: "bg-danger"}
          }
        },
      ],
      tableButtons: [
        {
          icon: "trash",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            }
          },
          title: "Delete",
          action: "deleteTemplate",
        },
        {
          icon: "play",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            }
          },
          title: "Use",
          action: "useTemplate",
        },
      ],
    };
  },
  computed:{
    savedTemplates() {
      return this.$store.getters["table/study/getFiltered"]((s) => s.template === true);
    }
  },
  methods: {
    open() {
      console.log("Opening Saved Templates Modal with templates:", this.savedTemplates);
      this.$refs.savedTemplatesModal.open();
    },
    close() {
      this.$refs.savedTemplatesModal.close();
    },
    handleAction({ action, params }) {
      console.log("Action:", action, "Params:", params);
      if (action === "deleteTemplate") {
        this.deleteTemplate(params);
      } else if (action === "useTemplate") {
        this.useTemplate(params);
      }
    },
    deleteTemplate(template) {
        console.log("Deleting template:", template);
        this.$socket.emit("appDataUpdate", {
          table: "study",
          data: {
            id: template.id,
            deleted: true
          }
        }, (result) => {
          if (result.success) {
            this.eventBus.emit('toast', {
              title: "Study template deleted",
              message: "The study template has been deleted",
              variant: "success"
            });
          } else {
            this.eventBus.emit('toast', {
              title: "Study template deletion failed",
              message: result.message,
              variant: "danger"
            });
          }
        });
    },
    useTemplate(template) {
      console.log("Using template:", template);
      this.close();
      this.$refs.studyCoordinator.open(template.id, null, false);
    },
  },
};
</script>

<style scoped>
.modal-title {
  font-weight: bold;
}
</style>
