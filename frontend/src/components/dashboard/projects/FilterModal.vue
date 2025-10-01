<template>
  <BasicModal ref="filterModal" name="filterModal" title="Filter" @hide="hide" size="xl">
    <template v-if="currentData" #body>
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
        title="Save"
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
          {name: "ID", key: "id"},
          {name: "extId", key: "extId"},
          {name: "First Name", key: "firstName"},
          {name: "Last Name", key: "lastName"},
          {name: "Number of Assignments", key: "studySessions"},
          {name: "Documents", key: "documents", width: 1, sortable: true},
          {name: "Roles", key: "rolesNames"},
        ]
      }
      return [
        {name: "ID", key: "id"},
      ];
    },
    filterSelectionFields() {
      return [
        {
          key: "table",
          type: "select",
          label: "From which should be filtered?",
          options: [
            {name: "User", value: "user"},
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