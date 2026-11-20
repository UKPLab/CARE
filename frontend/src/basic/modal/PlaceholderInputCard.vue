<template>
      <div class="placeholder-item mb-3">
        <div class="placeholder-header mb-2">
          <span class="placeholder-badge" :style="{ backgroundColor: color }">
            {{ placeholder.text }}
          </span>
          <span class="placeholder-type">{{ placeholder.type }}</span>
        </div>

        <!-- Comparison Type (requires 2 inputs) -->
        <div v-if="placeholder.type === 'comparison'" class="comparison-inputs">
          <div class="input-group mb-2">
            <label class="form-label">{{ $t('modals.placeholders.firstDataSource') }}</label>
            <select
              :value="value?.dataInput?.[0]?.value || ''"
              class="form-control"
              @change="$emit('comparison-change',0,$event.target.value)"
            >
              <option value="">{{ $t('modals.placeholders.selectFirstDataSource') }}</option>
              <option
                v-for="source in availableDataSources"
                :key="`${source.stepId}-${source.value}-0`"
                :value="source.value"
                :data-step-id="source.stepId"
              >
                {{ source.name }}
              </option>
            </select>
          </div>

          <div class="input-group mb-2">
            <label class="form-label">{{ $t('modals.placeholders.secondDataSource') }}</label>
            <select
              :value="value?.dataInput?.[1]?.value || ''"
              class="form-control"
              @change="$emit('comparison-change',1,$event.target.value)"
            >
              <option value="">{{ $t('modals.placeholders.selectSecondDataSource') }}</option>
              <option
                v-for="source in availableDataSources"
                :key="`${source.stepId}-${source.value}-1`"
                :value="source.value"
                :data-step-id="source.stepId"
              >
                {{ source.name }}
              </option>
            </select>
          </div>
        </div>

        <!-- Single Input Types (text, chart) -->
        <div v-else class="single-input">
          <label class="form-label">{{ $t('modals.placeholders.dataSource') }}</label>
          <select
            :value="value?.dataInput?.value || ''"
            class="form-control"
            @change="$emit('single-change',$event.target.value)"
          >
            <option value="">{{ $t('modals.placeholders.selectDataSource') }}</option>
            <option
              v-for="source in availableDataSources"
              :key="`${source.stepId}-${source.value}`"
              :value="source.value"
              :data-step-id="source.stepId"
            >
              {{ source.name }}
            </option>
          </select>
        </div>
      </div>
</template>
<script>
export default {
  name:'PlaceholderInputCard',
  props:{placeholder:{type:Object,required:true},color:{type:String,required:true},value:{type:Object,default:null},availableDataSources:{type:Array,required:true}},
  emits:['comparison-change','single-change'],
};
</script>
<style scoped>
.placeholder-item {
  background-color: var(--bs-body-bg, #ffffff);
  padding: 1rem;
  border-radius: 0.5rem;
  border: 1px solid var(--bs-border-color, #e9ecef);
}

.placeholder-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.placeholder-badge {
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.8rem;
  font-weight: bold;
}

.placeholder-type {
  background-color: var(--bs-secondary-bg, #6c757d);
  color: var(--bs-body-color, white);
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.7rem;
  text-transform: uppercase;
  font-weight: bold;
}

.comparison-inputs,
.single-input {
  background-color: var(--bs-secondary-bg, #f1f3f4);
  padding: 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid var(--bs-border-color, #e9ecef);
}

.input-group {
  background-color: var(--bs-body-bg, #ffffff);
  padding: 0.5rem;
  border-radius: 0.25rem;
  border: 1px solid var(--bs-border-color, #dee2e6);
}

.form-label {
  font-weight: 500;
  color: var(--bs-body-color, #495057);
  margin-bottom: 0.5rem;
}

.form-control {
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}

.form-control:focus {
  border-color: var(--care-primary);
  box-shadow: 0 0 0 0.25rem color-mix(in srgb, var(--care-primary) 25%, transparent);
}
</style>
