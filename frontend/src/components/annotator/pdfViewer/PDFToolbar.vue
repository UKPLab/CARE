<template>
  <div 
    ref="toolbar"
    class="pdf-toolbar" 
    :class="{ 'collapsed': !toolbarVisible, 'loading': isZooming }"
  >  
    <template v-if="toolbarVisible">       
      <TopBarButton
        title="Reset"
        text="Reset"
        :disabled="isZooming"
        @click="$emit('reset')"
      />      
      <TopBarButton
        icon="plus-lg"
        :disabled="isZooming"
        @click="$emit('zoom-in')"
      />
      <TopBarButton
        icon="dash-lg"
        :disabled="isZooming"
        @click="$emit('zoom-out')"
      />      
      <BasicForm
        :model-value="zoomFormData"
        :fields="zoomFields"
        @update:model-value="$emit('update:zoomFormData', $event)"
      />
    </template>

    <!-- Toggle Button (always visible) -->
    <button 
      class="toolbar-toggle-btn" 
      @click="toggleToolbar" 
      :title="toolbarVisible ? 'Minimize Toolbar' : 'Show Toolbar'"
    >
      <LoadIcon :icon-name="toolbarVisible ? 'chevron-right' : 'tools'" :size="20" />
    </button>
  </div>
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";
import TopBarButton from "@/basic/navigation/TopBarButton.vue";
import BasicForm from "@/basic/Form.vue";

/**
 * PDF Toolbar Component
 * 
 * Provides zoom controls and toolbar visibility toggle for the PDF viewer.
 * 
 * @author GitHub Copilot
 */
export default {
  name: "PDFToolbar",
  components: {
    LoadIcon,
    TopBarButton,
    BasicForm,
  },
  props: {
    zoomFormData: {
      type: Object,
      required: true,
    },
    modelValue: {
      type: Boolean,
      default: false,
    },
    isZooming: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:model-value', 'update:zoomFormData', 'zoom-in', 'zoom-out', 'reset'],
  data() {
    return {
      baseZoomOptions: this.generateZoomOptions(50, 200, 10),
    };
  },
  computed: {
    toolbarVisible: {
      get() {
        return this.modelValue;
      },
      set(value) {
        this.$emit('update:model-value', value);
      },
    },
    zoomPercentage() {
      return Math.round((this.zoomFormData.zoom || 1) * 100);
    },
    zoomFields() {
      const currentZoom = this.zoomPercentage;
      let options = [...this.baseZoomOptions];
      
      // If current zoom is outside the base range or not in the list, add it temporarily
      const existingOption = options.find(opt => opt.value === this.zoomFormData.zoom);
      if (!existingOption) {
        options.push({
          value: this.zoomFormData.zoom,
          name: `${currentZoom}%`
        });
        // Sort options by value
        options.sort((a, b) => a.value - b.value);
      }
      
      return [
        {
          key: "zoom",
          type: "select",
          options: options,
        },
      ];
    },
  },
  methods: {
    toggleToolbar() {
      this.toolbarVisible = !this.toolbarVisible;
    },
    generateZoomOptions(min, max, step) {
      const options = [];
      for (let i = min; i <= max; i += step) {
        options.push({
          value: i / 100,
          name: `${i}%`
        });
      }
      return options;
    },
  },
};
</script>

<style scoped>
.pdf-toolbar {
  position: sticky;
  top: 0;
  z-index: 200;
  background: #f8f9fa;
  border-bottom: 1px solid #ddd;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  min-height: 48px;
  position: relative;
  box-shadow: 0 2px 6px rgba(0,0,0,0.08);
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  justify-content: flex-end;
}

.pdf-toolbar.collapsed {
  width: 64px;
  padding: 8px;
  justify-content: center;
  margin-left: auto;
}

.pdf-toolbar :deep(.btn) {
  transition: all 0.2s ease;
}

.pdf-toolbar :deep(.btn:hover) {
  background-color: #e9ecef;
  transform: translateY(-2px);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.toolbar-toggle-btn {
  margin-left: auto;
  background: none;
  border: none;
  padding: 6px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #6c757d;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 32px;
  min-height: 32px;
}

.toolbar-toggle-btn:hover {
  background: #e9ecef;
  transform: scale(1.1);
}

.pdf-toolbar.collapsed .toolbar-toggle-btn {
  margin-left: 0;
  color: #6c757d;
}

.pdf-toolbar.collapsed .toolbar-toggle-btn:hover {
  color: #6c757d;
}

.pdf-toolbar.loading::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(248, 249, 250, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: all;
  cursor: wait;
}

.pdf-toolbar.loading :deep(.btn) {
  pointer-events: none;
  opacity: 0.6;
}

.pdf-toolbar.loading :deep(.form-select) {
  pointer-events: none;
  opacity: 0.6;
}
</style>
