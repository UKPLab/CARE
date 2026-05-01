<template>
  <BasicModal ref="filterModal" name="filterModal" :title="$t('common.filter')" size="xl" @hide="hide">
    <template v-if="currentData" #body>
      <!-- TODO: BasicTable now comes with a :max-table-height property to control its height, 
       so we may not the .table-scroll-container here. However, since FilterModal is not in use, 
       so the removal of the class is to be done when this component is in use.
       -->
      <div class="table-scroll-container">
      <BasicForm
        ref="filterSelectionForm"
        v-model="currentData.options"
        :fields="filterSelectionFields"
      />
      <br>
      <BasicTable
        v-model="currentData.selected"
        :columns="dataTableColumns"
        :data="dataTable"
        :options="dataTableOptions"/>
      </div>
    </template>

    <template #footer>
      <BasicButton
        :title="$t('common.save')"
        class="btn btn-primary"
        @click="$refs.filterModal.close()"
      />
    </template>

  </BasicModal>
</template>

<script>
import BasicModal from "@/basic/Modal.vue";
import BasicTable from "@/basic/Table.vue";
import BasicForm from "@/basic/Form.vue";
import BasicButton from "@/basic/Button.vue";

export default {
  name: "FilterModal",
  components: {BasicButton, BasicForm, BasicTable, BasicModal},
  inject: {
    exportStepper: {
      default: null
    },
  },
  props: {
    modelValue: {
      type: Object,
      required: true,
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      currentData: null,
      dataTableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: true,
        scrollY: true,
        scrollX: true,
        onlyOneRowSelectable: false,
        search: true
      },
    }
  },
  computed: {
    data() {
      if (this.currentData.table) {
        return this.$store.getters["table/" + this.currentData.table + "/getAll"];
      }
      return [];
    },
    documents() {
      return this.$store.getters["table/document/getAll"];
    },
    roles() {
      return this.$store.getters["admin/getSystemRoles"];
    },
    dataTable() {
      if (this.currentData.options && this.currentData.options.table === "user") {
        return this.users.map((r) => {
          let newR = {...r};
          newR.documents = this.documents.filter((d) => d.userId === r.id).length;
          newR.rolesNames = r.roles.map((role) => this.roles.find((r) => r.id === role).name);
          newR.rolesNames = newR.rolesNames.join(", ");
          return newR;
        });
      }
      return [];
    },
    users() {
      return this.$store.getters["table/user/getAll"];
    },
    dataTableColumns() {
      if (this.currentData.options && this.currentData.options.table === "user") {
        return [
          {name: this.$t('common.id'), key: "id"},
          {name: this.$t('dashboard.projects.extId'), key: "extId"},
          {name: this.$t('common.firstName'), key: "firstName"},
          {name: this.$t('common.lastName'), key: "lastName"},
          {name: this.$t('dashboard.projects.numberOfAssignments'), key: "studySessions"},
          {name: this.$t('documents.title'), key: "documents", width: 1, sortable: true},
          {name: this.$t('dashboard.projects.roles'), key: "rolesNames"},
        ]
      }
      return [
        {name: this.$t('common.id'), key: "id"},
      ];
    },
    filterSelectionFields() {
      return [
        {
          key: "table",
          type: "select",
          label: this.$t('dashboard.projects.filterTable'),
          options: [
            {name: this.$t('common.user'), value: "user"},
          ],
          required: true,
        },
      ];
    },
  },
  watch: {
    currentData() {
      this.$emit("update:modelValue", this.currentData);
    },
    modelValue() {
      this.currentData = this.modelValue;
    },
  },
  mounted() {
    if (this.modelValue !== null) {
      this.currentData = this.modelValue;
    } else {
      this.currentData = this.getEmptyData();
    }
  },
  methods: {
    open() {
      this.exportStepper?.hide();
      this.$refs.filterModal.open();
    },
    hide() {
      this.exportStepper?.show();
    },
    getEmptyData() {
      return {
        selected: [],
        options: {
          table: "user"
        },
      };
    }

  }
}
</script>


<style scoped>
.table-scroll-container {
  max-height: 400px;
  overflow-y: auto;
}
</style>