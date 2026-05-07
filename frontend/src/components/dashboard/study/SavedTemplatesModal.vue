<template>
  <span>
  <StudyModal ref="studyCoordinator"/>
  <BasicModal
    ref="savedTemplatesModal"
    name="savedTemplatesModal"
    size="lg"
  >
    <template #title>
      <h5 class="modal-title">{{$t('studies.savedTemplates')}}</h5>
    </template>
    <template #body>
      <BasicTable
        :columns="columns"
        :data="savedTemplates"
        :options="tableOptions"
        :buttons="tableButtons"
        :max-table-height="'60vh'"
        @action="handleAction"
      />
    </template>
    <template #footer>
      <BasicButton
        class="btn btn-primary"
        :title="$t('dashboard.study.createTemplate')"
        :name="$t('dashboard.study.createTemplate')"
        @click="createTemplate"
      />
      <BasicButton
        class="btn btn-secondary"
        :title="$t('common.close')"
        @click="close"
      />      
    </template>
  </BasicModal>
  <ConfirmModal ref="deleteConf"/>
</span>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicTable from "@/basic/Table.vue";
import BasicButton from "@/basic/Button.vue";
import StudyModal from "@/components/dashboard/coordinator/Study.vue";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import { formatLocalizedDate, resolveApiMessage } from "@/assets/utils";
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
  components: { BasicModal, BasicTable, BasicButton, StudyModal, ConfirmModal },
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
        { name: this.$t('common.name'), key: "name" },
        { name: this.$t('common.createdAt'), key: "createdAt", sortable: true },
        {
          name: this.$t('studies.columns.resumable'),
          key: "resumable",
          type: "badge",
          typeOptions: {
            keyMapping: {true: this.$t('common.yes'), false: this.$t('common.no')},
            classMapping: {true: "bg-success", false: "bg-danger"}
          }
        },
        {
          name: this.$t('studies.columns.collaborative'),
          key: "collab",
          type: "badge",
          typeOptions: {
            keyMapping: {true: this.$t('common.yes'), false: this.$t('common.no')},
            classMapping: {true: "bg-success", false: "bg-danger"}
          }
        },
        {
          name: this.$t('studies.columns.multipleSubmissions'),
          key: "multipleSubmit",
          type: "badge",
          typeOptions: {
            keyMapping: {true: this.$t('common.yes'), false: this.$t('common.no')},
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
          title: this.$t('common.delete'),
          filter: [
            {key: "showDeleteTemplateButton", value: true},
          ],
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
          title: this.$t('common.use'),
          action: "useTemplate",
        },
      ],
    };
  },
  computed:{
    savedTemplates() {
      return this.$store.getters["table/study/getFiltered"]((s) => s.template === true).map((s) => {
        return {
          id: s.id,
          name: s.name,
          createdAt: formatLocalizedDate(s.createdAt),
          resumable: s.resumable,
          collab: s.collab,
          multipleSubmit: s.multipleSubmit,
          showDeleteTemplateButton: this.showDeleteTemplateButton,
        };
      });
    },
    showDeleteTemplateButton() {
      return this.$store.getters["auth/checkRight"]("study.template.delete");
    }
  },
  methods: {
    open() {
      this.$refs.savedTemplatesModal.open();
    },
    close() {
      this.$refs.savedTemplatesModal.close();
    },
    handleAction({ action, params }) {
      if (action === "deleteTemplate") {
        this.deleteTemplate(params);
      } else if (action === "useTemplate") {
        this.useTemplate(params);
      }
    },
    deleteTemplate(template) {
      this.$refs.deleteConf.open(
        this.$t('dashboard.study.deleteTemplate'),
        this.$t('dashboard.study.deleteTemplatePrompt'),
        "",
        function (val) {
          if (val) {
            this.$socket.emit("appDataUpdate", {
              table: "study",
              data: {
                id: template.id,
                deleted: true
              }
            }, (result) => {
              if (result.success) {
                this.eventBus.emit('toast', {
                  title: this.$t('dashboard.study.studyTemplateDeleted'),
                  message: this.$t('dashboard.study.studyTemplateDeletedMessage'),
                  variant: "success"
                });
              } else {
                this.eventBus.emit('toast', {
                  title: this.$t('dashboard.study.deletionFailed'),
                  message: resolveApiMessage(result),
                  variant: "danger"
                });
              }
            });
          }
        }
      );
    },
    useTemplate(template) {
      this.close();
      this.$refs.studyCoordinator.open(template.id, null, false, false, true);
    },
    createTemplate() {
      this.close();
      this.$refs.studyCoordinator.open(0, null, false, true, false);
    },
  },
};
</script>

<style scoped>
.modal-title {
  font-weight: bold;
}
</style>
