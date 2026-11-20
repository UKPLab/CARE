<template>
  <div 
    ref="toolbar"
    class="pdf-toolbar" 
    :class="{ 'collapsed': !toolbarVisible }"
  >  
    <template v-if="toolbarVisible">       
      <TopBarButton
        :title="$t('common.reset')"
        :text="$t('common.reset')"
        @click="$emit('reset')"
      />      
      <TopBarButton
        icon="plus-lg"
        @click="$emit('zoom-in')"
      />
      <TopBarButton
        icon="dash-lg"
        @click="$emit('zoom-out')"
      />      
      <BasicForm
        :model-value="zoomFormData"
        :fields="zoomFields"
        @update:model-value="$emit('update:zoomFormData', $event)"
      />
      <TopBarButton
        :icon="pdfDarkMode ? 'sun' : 'moon-stars'"
        @click="$emit('toggle-pdf-theme')"
      />
    </template>

    <!-- Toggle Button (always visible) -->
    <BasicButton
      class="toolbar-toggle-btn"
      :icon="toolbarVisible ? 'chevron-right' : 'tools'"
      :tooltip="toolbarVisible ? $t('components.pdftoolbar.minToolbar') : $t('components.pdftoolbar.showToolbar')"
      @click="toggleToolbar"
    />
  </div>
</template>

<script>
import TopBarButton from "@/basic/navigation/TopBarButton.vue";
import BasicForm from "@/basic/Form.vue";
import BasicButton from "@/basic/Button.vue";

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
    TopBarButton,
    BasicForm,
    BasicButton,
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
    pdfDarkMode: {
      type: Boolean,
      default: true,
    },
  },
  emits: ['update:model-value', 'update:zoomFormData', 'zoom-in', 'zoom-out', 'reset', 'toggle-pdf-theme'],
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
  background: var(--bs-tertiary-bg, #f8f9fa);
  border-bottom: 1px solid var(--bs-border-color, #ddd);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  min-height: 48px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.08);
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
  background-color: var(--bs-secondary-bg, #e9ecef);
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
  color: var(--bs-secondary-color, #6c757d);
  min-width: 32px;
  min-height: 32px;
}

.toolbar-toggle-btn:hover {
  background: var(--bs-secondary-bg, #e9ecef);
  transform: scale(1.1);
}

.pdf-toolbar.collapsed .toolbar-toggle-btn {
  margin-left: 0;
  color: var(--bs-body-color, #6c757d);
}

.pdf-toolbar.collapsed .toolbar-toggle-btn:hover {
  color: var(--bs-body-color, #6c757d);
}
</style>
