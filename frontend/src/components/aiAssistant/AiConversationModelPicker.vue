<template>
<div class="dropdown">
          <BasicButton
              class="btn btn-sm composer-model d-inline-flex align-items-center gap-1"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              :disabled="disabled"
          >
            <BasicIcon icon-name="cpu" :size="15" />
            <span class="composer-model-name">{{ selectedModelName }}</span>
            <BasicIcon icon-name="chevron-down" :size="14" />
          </BasicButton>
          <ul class="dropdown-menu composer-model-menu">
            <li><h6 class="dropdown-header">{{ $t('ai.chat.switchModel') }}</h6></li>
            <li v-for="model in models" :key="model.id">
              <BasicButton
                  class="dropdown-item d-flex align-items-center gap-2"
                  :class="{active: Number(model.id) === selectedModelId}"
                  @click="$emit('update:selectedModelId', Number(model.id))"
              >
                <BasicIcon icon-name="cpu" :size="15" />
                <span class="model-option-name flex-grow-1">{{ model.name }}</span>
                <BasicIcon
                    v-if="Number(model.id) === selectedModelId"
                    icon-name="check2"
                    :size="15"
                />
              </BasicButton>
            </li>
            <li v-if="models.length === 0">
              <span class="dropdown-item disabled text-muted">{{ $t('ai.chat.noModels') }}</span>
            </li>
          </ul>
        </div>
</template>

<script>
import BasicButton from "@/basic/Button.vue";
import BasicIcon from "@/basic/Icon.vue";

export default {
  name: "AiConversationModelPicker",
  components: {BasicButton, BasicIcon},
  props: {
    models: {type: Array, required: true},
    selectedModelId: {type: Number, default: null},
    disabled: {type: Boolean, default: false},
  },
  emits: ["update:selectedModelId"],
  computed: {
    selectedModelName() {
      const model = this.models.find(item => Number(item.id) === this.selectedModelId);
      return model ? model.name : this.$t("ai.models.selectModel");
    },
  },
};
</script>

<style scoped>
/* Subtle, borderless model picker; hover/focus stay on-theme. */
.composer-model {
  max-width: 220px;
  color: var(--bs-secondary-color);
}

.composer-model-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.composer-model:hover:not(:disabled),
.composer-model:focus-visible {
  background-color: var(--bs-secondary-bg);
  color: var(--bs-body-color);
}

/* Ghost button: no border, ring, or shadow in any state, including the
   active/open (.show) state and BasicButton's own hover shadow. */
.composer-model,
.composer-model:hover,
.composer-model:focus,
.composer-model:focus-visible,
.composer-model:active,
.composer-model.active,
.composer-model.show {
  border-color: transparent !important;
  outline: none !important;
  box-shadow: none !important;
}

/* Roomier menu: consistent padding, rounded rows, a quiet section title. */
.composer-model-menu {
  min-width: 12rem;
  padding: 0.35rem;
}

.composer-model-menu .dropdown-header {
  padding: 0.25rem 0.6rem 0.4rem;
  font-size: 0.7rem;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--bs-secondary-color);
}

.composer-model-menu :deep(.dropdown-item) {
  padding: 0.4rem 0.6rem;
  border-radius: var(--bs-border-radius);
}

.model-option-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Items are BasicButton, so reach past its scoped styles with :deep. */
.dropdown-menu :deep(.dropdown-item:hover),
.dropdown-menu :deep(.dropdown-item:focus),
.dropdown-menu :deep(.dropdown-item:focus-visible) {
  background-color: var(--bs-secondary-bg);
  color: var(--bs-body-color);
  outline: none;
  box-shadow: none;
}

.dropdown-menu :deep(.dropdown-item.active) {
  background-color: var(--bs-primary-bg-subtle);
  color: var(--bs-primary-text-emphasis);
  border-color: transparent;
  box-shadow: none;
}
</style>
