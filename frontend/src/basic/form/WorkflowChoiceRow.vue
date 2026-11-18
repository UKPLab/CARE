<template>
          <tr>
            <td
              v-for="field in fields"
              :key="field.key"
            >
              <div class="d-flex align-items-center">
                <span class="badge bg-primary me-2">
                  <i class="bi bi-file-earmark-text"></i> {{ choice.stepNumber }}
                </span>
                <div class="flex-grow-1 d-flex align-items-center">
                  <FormSelect
                    v-if="field.type === 'select'"
                    :ref="'ref_' + field.key"
                    :model-value="getFieldValue(field.key)"
                    :data-table="true"
                    :parent-value="choice"
                    :options="{ options: field.options }"
                    :placeholder="field.label"
                    class="flex-grow-1"
                    style="min-width: 200px; max-width: 800px"
                    @update:model-value="(val) => $emit('update-field', field.key, val)"
                  />
                  <FormDefault
                    v-else
                    :ref="'ref_' + field.key"
                    :model-value="values[field.key]"
                    :data-table="true"
                    :options="field"
                    @update:model-value="$emit('update-field', field.key, $event)"
                  />
                  <span
                    v-if="choice.hasConfiguration"
                    class="ms-2"
                  >
                    <ConfigurationModal
                      :model-value="values.configuration"
                      :study-step-id="choice.id"
                      :step-number="choice.stepNumber"
                      :document-id="documentId"
                      :workflow-steps="workflowSteps"
                      @update:model-value="(configData) => $emit('update-configuration', configData)"
                    />
                  </span>
                </div>
              </div>
            </td>
          </tr>
</template>
<script>
import FormDefault from './Default.vue';
import FormSelect from './Select.vue';
import {defineAsyncComponent} from 'vue';
export default {
  name: 'WorkflowChoiceRow',
  components: {FormDefault, FormSelect, ConfigurationModal: defineAsyncComponent(() => import('@/basic/modal/ConfigurationModal.vue'))},
  props: {choice: {type: Object, required:true}, fields:{type:Array,required:true}, values:{type:Object,required:true}, documentId:{type:Number,default:null}, workflowSteps:{type:Array,required:true}},
  emits: ['update-field','update-configuration'],
  methods: {
    getFieldValue(fieldKey) {
      const item = this.values;

      // If there is a parentDocumentId in the current item, use it for select fields
      if (item && item.parentDocumentId) {
        return item.parentDocumentId;
      }

      // Otherwise use the current value
      return item ? item[fieldKey] : null;
    }
 },
};
</script>
