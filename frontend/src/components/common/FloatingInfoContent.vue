<template>
    <div class="info-panel-header">
      <h6 class="mb-2">{{ translateMaybeKey(selectedItem.name) }}</h6>
    </div>
    <div class="info-panel-content">
      <div v-if="selectedItem.description" class="mb-3">
        <strong>{{ $t('infoPanel.description')}}</strong>
        <p class="mb-0 mt-1">{{ translateMaybeKey(selectedItem.description) }}</p>
      </div>

      <!-- Show maximum points for rubric groups only (groups have maxScore) -->
      <div v-if="selectedItem.maxScore !== undefined" class="mb-3">
        <strong>{{ $t('infoPanel.maxPoints')}}</strong>
        <span class="badge bg-secondary ms-2">{{ selectedItem.maxScore }} {{ $t('infoPanel.pointsAbbreviation')}}</span>
      </div>

      <div v-if="selectedItem.scoring && selectedItem.scoring.length > 0">
        <strong>{{ $t('infoPanel.scoringCriteria')}}</strong>
        <div class="scoring-list mt-2">
          <div 
            v-for="(option, index) in selectedItem.scoring" 
            :key="index"
            class="scoring-item p-2 border rounded mb-2 border-secondary"
          >
            <div class="d-flex justify-content-between align-items-start">
              <span class="badge bg-secondary me-2">{{ option.score ?? option.points }} {{ $t('infoPanel.pointsAbbreviation')}}</span>
              <span class="flex-grow-1">{{ translateMaybeKey(option.description) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
</template>

<script>
import {translateMaybeKey} from "@/assets/utils";

export default {
  name: "FloatingInfoContent",
  props: {selectedItem: {type: Object, required: true}},
  methods: {translateMaybeKey},
};
</script>

<style scoped>
.info-panel-header {
  background-color: var(--bs-tertiary-bg, #f8f9fa);
  padding: 12px 16px;
  border-bottom: 1px solid var(--bs-border-color, #dee2e6);
  border-radius: 8px 8px 0 0;
  position: relative;
}

.info-panel-header h6 {
  margin: 0;
  color: var(--bs-body-color, #495057);
  font-weight: 600;
  padding-right: 30px; /* Make room for pin button */
}

.info-panel-content {
  padding: 16px;
}

.info-panel-content p {
  color: var(--bs-secondary-color, #6c757d);
  line-height: 1.4;
}

.scoring-list {
  max-height: 300px;
  overflow-y: auto;
}

.scoring-item {
  background-color: var(--bs-tertiary-bg, #f8f9fa);
  transition: background-color 0.2s;
}

.scoring-item:hover {
  background-color: var(--bs-secondary-bg, #e9ecef);
}

.badge {
  font-size: 0.75rem;
  min-width: 45px;
  text-align: center;
}

.scoring-list::-webkit-scrollbar {
  width: 6px;
}

.scoring-list::-webkit-scrollbar-track {
  background: var(--bs-tertiary-bg, #f1f1f1);
  border-radius: 3px;
}

.scoring-list::-webkit-scrollbar-thumb {
  background: var(--bs-secondary-color, #c1c1c1);
  border-radius: 3px;
}

.scoring-list::-webkit-scrollbar-thumb:hover {
  background: var(--bs-body-color, #a8a8a8);
}
</style>
