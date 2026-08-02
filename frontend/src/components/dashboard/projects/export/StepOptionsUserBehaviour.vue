<template>
  <div class="mt-2 mb-3 p-3 bg-light border rounded">
    <h6 class="mb-3 pb-2 border-bottom text-muted">
      User Behaviour Options
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
                    label: "File Layout",
                    type: "select",
                    options: [
                        { name: "Single combined file", value: "single" },
                        { name: "One file per user", value: "perUser" },
                    ],
                },
                {
                    key: "fileFormat",
                    label: "File Format",
                    type: "select",
                    options: [
                        { name: "JSON", value: "json" },
                        { name: "CSV", value: "csv" },
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