<template>
  <div 
    v-if="show && selectedItem"
    ref="infoPanel"
    class="floating-info-panel"
    :style="panelStyle"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <FloatingInfoContent :selected-item="selectedItem"/>
  </div>
</template>

<script>
import FloatingInfoContent from "./FloatingInfoContent.vue";

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
  components: {FloatingInfoContent},

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
  background: var(--bs-body-bg, white);
  border: 1px solid var(--bs-border-color, #dee2e6);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow-y: auto;
  font-size: 0.875rem;
}

.floating-info-panel::-webkit-scrollbar {
  width: 6px;
}

.floating-info-panel::-webkit-scrollbar-track {
  background: var(--bs-tertiary-bg, #f1f1f1);
  border-radius: 3px;
}

.floating-info-panel::-webkit-scrollbar-thumb {
  background: var(--bs-secondary-color, #c1c1c1);
  border-radius: 3px;
}

.floating-info-panel::-webkit-scrollbar-thumb:hover {
  background: var(--bs-body-color, #a8a8a8);
}
</style>
