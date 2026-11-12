<template>
  <div class="pdf-toolbar-anchor">
  <div 
    ref="toolbar"
    class="pdf-toolbar" 
    :class="{ 'collapsed': !toolbarVisible }"
    v-bind="$attrs"
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
  inheritAttrs: false,
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
/* Positioned by .pdf-toolbar-slot in Annotator.vue, outside the scroller. */
.pdf-toolbar-anchor {
  display: flex;
  justify-content: flex-end;
  pointer-events: none;
}

.pdf-toolbar {
  pointer-events: auto;
  width: fit-content;
  background: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: var(--care-radius-pill);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  min-height: 40px;
  box-shadow: 0 4px 8px -2px rgb(var(--care-shadow-rgb) / .10), 0 2px 4px -2px rgb(var(--care-shadow-rgb) / .06);
}

.pdf-toolbar.collapsed {
  padding: 4px;
}

.pdf-toolbar :deep(.btn) {
  transition: background-color var(--care-dur-fast) var(--care-ease), color var(--care-dur-fast) var(--care-ease), border-color var(--care-dur-fast) var(--care-ease);
}

.pdf-toolbar :deep(.btn:hover) {
  background-color: var(--bs-secondary-bg, #e9ecef);
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
}

.pdf-toolbar.collapsed .toolbar-toggle-btn {
  margin-left: 0;
  color: var(--bs-body-color, #6c757d);
}

.pdf-toolbar.collapsed .toolbar-toggle-btn:hover {
  color: var(--bs-body-color, #6c757d);
}
</style>
