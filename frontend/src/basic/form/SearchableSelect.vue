<template>
      <div
        ref="searchSelect"
        class="searchable-select w-100"
      >
        <input
          v-if="isOpen"
          ref="searchInput"
          v-model="searchQuery"
          type="text"
          class="form-select searchable-select-toggle"
          :class="selectClass"
          :disabled="isDisabled"
          :placeholder="options.placeholder || $t('common.search')"
          :aria-label="$t('common.searchOptions')"
          @keydown.escape.prevent="isOpen = false"
        >
        <button
          v-else
          type="button"
          class="form-select text-start searchable-select-toggle"
          :class="selectClass"
          :disabled="isDisabled"
          @click="isOpen = true"
        >
          <span
            class="searchable-select-label"
            :class="{ 'text-muted': !hasSelection }"
          >
            {{ selectedLabel }}
          </span>
        </button>
        <div
          v-if="isOpen"
          class="dropdown-menu show searchable-select-menu w-100"
        >
          <div class="searchable-select-options">
            <button
              v-for="option in filteredSelectOptions"
              :key="option.value"
              type="button"
              class="dropdown-item"
              :class="[option.class, { active: currentData === option.value }]"
              :disabled="option.disabled"
              @mousedown.prevent="selectOption(option)"
            >
              {{ translateMaybeKey(option.name) }}
            </button>
            <div
              v-if="filteredSelectOptions.length === 0"
              class="dropdown-item text-muted disabled"
            >
              {{ $t('common.noMatches') }}
            </div>
          </div>
        </div>
      </div>
</template>
<script>
import {translateMaybeKey} from '@/assets/utils';
export default {
  name: 'SearchableSelect',
  props: { modelValue: {type: [Number,String,Object], default: null}, selectOptions: {type: Array, required:true},
   options: {type:Object, required:true}, selectClass: {type:String, default:''}, isDisabled: {type:Boolean,default:false}},
  emits: ['update:modelValue','blur'],
  data() {return {isOpen:false, searchQuery:''};},
  computed: {
  currentData: {get(){return this.modelValue;}, set(value){this.$emit('update:modelValue',value);}},
    filteredSelectOptions() {
      const query = this.searchQuery.trim().toLowerCase();
      if (!query) {
        return this.selectOptions;
      }
      return this.selectOptions.filter((option) =>
        String(option.name).toLowerCase().includes(query)
      );
    },
    hasSelection() {
      return this.currentData !== null
        && this.currentData !== undefined
        && this.currentData !== -1
        && this.currentData !== "";
    },
    selectedLabel() {
      const selected = this.selectOptions.find((option) => option.value === this.currentData);
      return selected?.name || this.options.placeholder || this.$t("common.selectPlaceholder");
    }
 },
  watch: {isOpen(open) {
      if (open) {
        this.searchQuery = "";
        this.$nextTick(() => this.$refs.searchInput?.focus());
      } else {
        this.searchQuery = "";
      }
    }},
  mounted() {document.addEventListener('mousedown', this.onDocumentClick);},
  beforeUnmount() {document.removeEventListener('mousedown', this.onDocumentClick);},
  methods: {translateMaybeKey,
    selectOption(option) {
      if (option.disabled) return;
      this.currentData = option.value;
      this.isOpen = false;
      this.$emit('blur', option.value !== -1);
    },
    onDocumentClick(event) {
      if (!this.isOpen) return;
      if (!this.$refs.searchSelect?.contains(event.target)) {
        this.isOpen = false;
      }
    }
 },
};
</script>
<style scoped>

.searchable-select {
  position: relative;
}

.searchable-select-toggle {
  width: 100%;
  background-color: var(--bs-body-bg, #fff);
}

button.searchable-select-toggle {
  display: flex;
  align-items: center;
  overflow: hidden;
  cursor: pointer;
}

input.searchable-select-toggle {
  cursor: text;
}

.searchable-select-toggle:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.searchable-select-label {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.searchable-select-menu {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 1050;
  max-height: 16rem;
  display: flex;
  flex-direction: column;
  padding: 0.25rem 0;
  margin-top: 0.125rem;
}

.searchable-select-options {
  overflow-y: auto;
  max-height: 16rem;
}
</style>
