<template>
  <div 
    v-if="show && selectedItem"
    ref="infoPanel"
    class="floating-info-panel"
    :style="panelStyle"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <div class="info-panel-header">
      <h6 class="mb-0">{{ translateMaybeKey(selectedItem.name) }}</h6>
      <span class="d-flex align-items-center gap-1">
        <LoadIcon
            v-if="isPinned"
            icon-name="pin-angle-fill"
            :size="14"
            aria-hidden="true"
        />
        <BasicButton
            class="info-panel-close"
            text=""
            icon="x-lg"
            :title="$t('common.close')"
            @click="$emit('dismiss')"
        />
      </span>
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
  </div>
</template>

<script>
import { translateMaybeKey } from "@/assets/utils";
import LoadIcon from "@/basic/Icon.vue";
import BasicButton from "@/basic/Button.vue";

/**
 * FloatingInfoPanel Component
 * 
 * A reusable floating panel that displays detailed information about criteria or groups.
 * Supports pinning, hover interactions, and positioning relative to a reference element.
 * 
 * @author Akash Gundapuneni
 */
export default {
  name: "FloatingInfoPanel",
  components: { LoadIcon, BasicButton },
  
  props: {
    show: {
      type: Boolean,
      default: false
    },
    selectedItem: {
      type: Object,
      default: null
    },
    referenceElement: {
      type: [Object, String],
      required: false,
      default: null
    },
    isPinned: {
      type: Boolean,
      default: false
    },
    width: {
      type: [Number, String],
      default: 350
    },
    maxHeight: {
      type: [Number, String],
      default: null
    },
    position: {
      type: String,
      default: 'left', // 'left', 'right', 'top', 'bottom'
      validator: (value) => ['left', 'right', 'top', 'bottom'].includes(value)
    },
    offset: {
      type: Number,
      default: 10
    },
    closeDelay: {
      type: Number,
      default: 0
    }
  },
  
  emits: [
    'pin-changed',
    'mouse-enter',
    'mouse-leave',
    'close-requested',
    'dismiss',
    'update:selectedItem',
    'update:referenceElement',
    'update:show'
  ],
  
  data() {
    return {
      localIsPinned: this.isPinned,
      isHovering: false,
      closeTimer: null,
      panelStyle: {}
    };
  },
  
  watch: {
    isPinned(newVal) {
      this.localIsPinned = newVal;
    },
    show(newVal) {
      if (newVal) {
        this.calculatePosition();
        this.clearCloseTimer();
      } else {
        this.localIsPinned = false;
        this.isHovering = false;
        this.clearCloseTimer();
      }
    },
    
    selectedItem() {
      if (this.show) {
        this.$nextTick(() => {
          this.calculatePosition();
        });
      }
    },
    
    referenceElement() {
      if (this.show) {
        this.$nextTick(() => {
          this.calculatePosition();
        });
      }
    }
  },
  
  mounted() {
    // Listen for global mouse events to handle outside clicks
    document.addEventListener('mousedown', this.onGlobalMouseDown);
    
    // Listen for window resize to recalculate position
    window.addEventListener('resize', this.onWindowResize);
  },
  
  beforeUnmount() {
    this.clearCloseTimer();
    document.removeEventListener('mousedown', this.onGlobalMouseDown);
    window.removeEventListener('resize', this.onWindowResize);
  },
  
  methods: {
    translateMaybeKey,
    calculatePosition() {
      if (!this.referenceElement) return;
      
      let refRect;
      if (typeof this.referenceElement === 'string') {
        const element = document.querySelector(this.referenceElement);
        if (!element) return;
        refRect = element.getBoundingClientRect();
      } else if (this.referenceElement.getBoundingClientRect) {
        refRect = this.referenceElement.getBoundingClientRect();
      } else if (this.referenceElement.left !== undefined) {
        // Assume it's already a rect-like object
        refRect = this.referenceElement;
      } else {
        return;
      }
      
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const panelWidth = typeof this.width === 'number' ? this.width : parseInt(this.width) || 350;
      
      let left, top;
      let computedMaxHeight = this.maxHeight;
      
      switch (this.position) {
        case 'left':
          left = refRect.left - panelWidth - this.offset;
          top = refRect.top;
          
          // Adjust if panel would go off-screen
          if (left < 0) {
            left = refRect.right + this.offset;
          }
          break;
          
        case 'right':
          left = refRect.right + this.offset;
          top = refRect.top;
          
          // Adjust if panel would go off-screen
          if (left + panelWidth > windowWidth) {
            left = refRect.left - panelWidth - this.offset;
          }
          break;
          
        case 'top':
          left = refRect.left;
          top = refRect.top - this.offset;
          
          // Center horizontally relative to reference element
          left = left - (panelWidth - refRect.width) / 2;
          break;
          
        case 'bottom':
          left = refRect.left;
          top = refRect.bottom + this.offset;
          
          // Center horizontally relative to reference element
          left = left - (panelWidth - refRect.width) / 2;
          break;
      }
      
      // Ensure panel stays within viewport bounds
      left = Math.max(10, Math.min(left, windowWidth - panelWidth - 10));
      top = Math.max(10, Math.min(top, windowHeight - 200)); // Leave some space at bottom
      
      // Calculate max height if not provided
      if (!computedMaxHeight) {
        computedMaxHeight = Math.max(200, windowHeight - top - 20);
      }
      
      this.panelStyle = {
        position: 'fixed',
        left: left + 'px',
        top: top + 'px',
        width: panelWidth + 'px',
        maxHeight: computedMaxHeight + 'px',
        zIndex: 9999
      };
    },
    
    togglePin() {
      this.localIsPinned = !this.localIsPinned;
      this.$emit('pin-changed', this.localIsPinned);
      
      if (!this.localIsPinned) {
        this.requestClose();
      }
    },
    
    onMouseEnter() {
      this.isHovering = true;
      this.clearCloseTimer();
      this.$emit('mouse-enter');
    },
    
    onMouseLeave() {
      this.isHovering = false;
      this.$emit('mouse-leave');
      this.requestClose();
    },
    
    requestClose() {
      if (this.localIsPinned) return;
      this.clearCloseTimer();
      this.closeTimer = setTimeout(() => {
        if (!this.localIsPinned && !this.isHovering) {
          this.$emit('close-requested');
        }
      }, this.closeDelay);
    },
    
    clearCloseTimer() {
      if (this.closeTimer) {
        clearTimeout(this.closeTimer);
        this.closeTimer = null;
      }
    },
    
    
    onWindowResize() {
      if (this.show) {
        this.$nextTick(() => {
          this.calculatePosition();
        });
      }
    },
    
    // Public methods for parent components
    open(item, referenceElement = null) {
      this.clearCloseTimer();
      this.$emit('update:selectedItem', item);
      if (referenceElement) {
        this.$emit('update:referenceElement', referenceElement);
      }
      this.$emit('update:show', true);
    },
    
    close() {
      this.localIsPinned = false;
      this.isHovering = false;
      this.clearCloseTimer();
      this.$emit('update:show', false);
    },
    
    pin() {
      this.localIsPinned = true;
      this.$emit('pin-changed', true);
    },
    
    unpin() {
      this.localIsPinned = false;
      this.$emit('pin-changed', false);
      this.requestClose();
    }
  }
};
</script>

<style scoped>
.floating-info-panel {
  background: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: var(--bs-border-radius-lg);
  box-shadow: var(--care-shadow-3);
  overflow-y: auto;
  font-size: 0.875rem;
  scrollbar-width: thin;
  scrollbar-color: rgba(var(--bs-secondary-rgb), .35) transparent;
}

.info-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .5rem;
  background: transparent;
  padding: 12px 16px;
  border-bottom: 1px solid var(--bs-border-color);
}

.info-panel-header h6 {
  margin: 0;
  color: var(--bs-body-color);
  font-weight: 600;
}

.info-panel-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: var(--bs-border-radius);
  background: transparent;
  color: var(--bs-secondary-color);
}

.info-panel-close:hover,
.info-panel-close:focus-visible {
  color: var(--care-primary);
  background: color-mix(in srgb, var(--care-primary) 12%, transparent);
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
  scrollbar-width: thin;
  scrollbar-color: rgba(var(--bs-secondary-rgb), .35) transparent;
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
  font-weight: 600;
}
</style>