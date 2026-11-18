<template>
  <div class="mb-3">
    <label class="form-label"><b>{{ $t("submission.publishAssessment.selectConfiguration") }}</b></label>
    <p class="small text-muted mb-3">
      {{ $t("submission.publishAssessment.selectConfigurationDescription") }}
    </p>
    <BasicTable
      :model-value="modelValue"
      :data="configurationsTable"
      :columns="columns"
      :options="tableOptions"
      :max-table-height="350"
      @update:model-value="$emit('update:modelValue', $event)"
    />
  </div>
</template>

<script>
import BasicTable from "@/basic/Table.vue";

/**
 * First step of the publish-assessment stepper: pick the assessment
 * configuration (rubric) whose scores are published.
 * The parent subscribes to the configuration table.
 *
 * @author: CARE Team
 */
export default {
  name: "PublishAssessmentConfigurationStep",
  components: { BasicTable },
  props: {
    modelValue: {
      type: Array,
      required: true,
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      tableOptions: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        selectableRows: true,
        singleSelect: true,
        pagination: 10,
        search: true,
      },
    };
  },
  computed: {
    configurationsTable() {
      const configurations = this.$store.getters["table/configuration/getFiltered"](
        (c) => c.type === 0 && !c.deleted
      ) || [];
      return configurations.map((c) => ({
        ...c,
        id: c.id,
        name: c.name,
        createdAt: c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "-",
      }));
    },
    columns() {
      return [
        { name: this.$t("common.id"), key: "id" },
        { name: this.$t("common.name"), key: "name" },
        { name: this.$t("submission.publishAssessment.columns.created"), key: "createdAt" },
      ];
    },
  },
};
</script>
