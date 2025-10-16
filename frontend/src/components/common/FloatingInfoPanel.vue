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
      <h6 class="mb-2">{{ selectedItem.name }}</h6>
    </div>
    <div class="info-panel-content">
      <div v-if="selectedItem.description" class="mb-3">
        <strong>Description:</strong>
        <p class="mb-0 mt-1">{{ selectedItem.description }}</p>
      </div>
      
      <div v-if="selectedItem.scoring && selectedItem.scoring.length > 0">
        <strong>Scoring Criteria:</strong>
        <div class="scoring-list mt-2">
          <div 
            v-for="(option, index) in selectedItem.scoring" 
            :key="index"
            class="scoring-item p-2 border rounded mb-2 border-secondary"
          >
            <div class="d-flex justify-content-between align-items-start">
              <span class="badge bg-secondary me-2">{{ option.score ?? option.points }} P</span>
              <span class="flex-grow-1">{{ option.description }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";

/**
 * FloatingInfoPanel Component
 * 
 * A reusable floating panel that displays detailed information about criteria or groups.
 * Supports pinning, hover interactions, and positioning relative to a reference element.
 * 
 * @author GitHub Copilot
 */
export default {
  name: "FloatingInfoPanel",
  components: { LoadIcon },
  
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
      required: true,
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
    'close-requested'
  ],
  
  data() {
    return {
      isPinned: false,
      isHovering: false,
      closeTimer: null,
      panelStyle: {}
    };
  },
  
  watch: {
    show(newVal) {
      if (newVal) {
        this.calculatePosition();
        this.clearCloseTimer();
      } else {
        this.isPinned = false;
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
      console.log("Toggling pin state:", this.isPinned);
      this.isPinned = !this.isPinned;
      console.log("Pin state changed to:", this.isPinned);
      this.$emit('pin-changed', this.isPinned);
      
      if (!this.isPinned) {
        this.requestClose();
      }
    },
    
    onMouseEnter() {
      this.isHovering = true;
      this.clearCloseTimer();
      this.$emit('mouse-enter');
    },
    
    onMouseLeave() {
      console.log("Mouse left info panel");
      this.isHovering = false;
      this.$emit('mouse-leave');
      this.requestClose();
    },
    
    requestClose() {
      if (this.isPinned) return;
      console.log("Requesting close of info panel after delay:", this.closeDelay);
      this.clearCloseTimer();
      this.closeTimer = setTimeout(() => {
        if (!this.isPinned && !this.isHovering) {
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
      this.isPinned = false;
      this.isHovering = false;
      this.clearCloseTimer();
      this.$emit('update:show', false);
    },
    
    pin() {
      this.isPinned = true;
      this.$emit('pin-changed', true);
    },
    
    unpin() {
      this.isPinned = false;
      this.$emit('pin-changed', false);
      this.requestClose();
    }
  }
};
</script>

<style scoped>
.floating-info-panel {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow-y: auto;
  font-size: 0.875rem;
}

.info-panel-header {
  background-color: #f8f9fa;
  padding: 12px 16px;
  border-bottom: 1px solid #dee2e6;
  border-radius: 8px 8px 0 0;
  position: relative;
}

.info-panel-header h6 {
  margin: 0;
  color: #495057;
  font-weight: 600;
  padding-right: 30px; /* Make room for pin button */
}

.btn-close {
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.btn-close:hover {
  opacity: 1;
}

.btn-close.pinned {
  opacity: 1;
  color: #0d6efd;
}

.info-panel-content {
  padding: 16px;
}

.info-panel-content p {
  color: #6c757d;
  line-height: 1.4;
}

.scoring-list {
  max-height: 300px;
  overflow-y: auto;
}

.scoring-item {
  background-color: #f8f9fa;
  transition: background-color 0.2s;
}

.scoring-item:hover {
  background-color: #e9ecef;
}

.badge {
  font-size: 0.75rem;
  min-width: 45px;
  text-align: center;
}

/* Scrollbar styling */
.floating-info-panel::-webkit-scrollbar,
.scoring-list::-webkit-scrollbar {
  width: 6px;
}

.floating-info-panel::-webkit-scrollbar-track,
.scoring-list::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.floating-info-panel::-webkit-scrollbar-thumb,
.scoring-list::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.floating-info-panel::-webkit-scrollbar-thumb:hover,
.scoring-list::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>