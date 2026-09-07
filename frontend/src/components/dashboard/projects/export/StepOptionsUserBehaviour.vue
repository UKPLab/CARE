<template>
  <div class="mt-2 mb-3 p-3 bg-body-tertiary border rounded">
    <h6 class="mb-3 pb-2 border-bottom text-muted">
      {{ $t('dashboard.projects.exportOptions.userBehaviour.title') }}
    </h6>
    <BasicForm
      v-model="optionsData"
      :fields="fields"
    />
  </div>
</template>

<script>
import BasicForm from "@/basic/Form.vue";

export default {
    name: "StepOptionsUserBehaviour",
    components: { BasicForm },
    props: {
        outputFormat: { type: String, default: "single" },
        fileFormat: { type: String, default: "json" }
    },
    emits: ['update:outputFormat', 'update:fileFormat'],
    data() {
        return {
            optionsData: {
            outputFormat: this.outputFormat,
            fileFormat: this.fileFormat
            }
        };
    },
    computed: {
        fields() {
            return [
                {
                    key: "outputFormat",
                    label: this.$t('dashboard.projects.exportOptions.userBehaviour.fileLayout'),
                    type: "select",
                    options: [
                        { name: this.$t('dashboard.projects.exportOptions.userBehaviour.singleCombinedFile'), value: "single" },
                        { name: this.$t('dashboard.projects.exportOptions.userBehaviour.onePerUser'), value: "perUser" },
                    ],
                },
                {
                    key: "fileFormat",
                    label: this.$t('dashboard.projects.exportOptions.userBehaviour.fileFormat'),
                    type: "select",
                    options: [
                        { name: this.$t('common.json'), value: "json" },
                        { name: this.$t('common.csv'), value: "csv" },
                    ],
                },
            ];
        }
    },
    watch: {
        outputFormat(value) { this.optionsData.outputFormat = value; },
        fileFormat(value) { this.optionsData.fileFormat = value; },
        optionsData: {
            handler(value) {
            this.$emit('update:outputFormat', value.outputFormat);
            this.$emit('update:fileFormat', value.fileFormat);
            },
            deep: true
        }
    }
}
</script>