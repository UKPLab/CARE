<template>
  <div 
    ref="indicator"
    class="readonly-watermark"
    :class="{ 'readonly-watermark--sticky': positionType === 'sticky' }"
    :style="{ position: positionType }"
  >  
    <LoadIcon icon-name="eye-slash" :size="120" />
  </div>
</template>

<script>
import LoadIcon from "@/basic/Icon.vue";

/**
 * Read-Only Indicator Component
 * 
 * Displays a subtle watermark indicating read-only mode.
 * 
 * @author Karim Ouf
 */
export default {
  name: "ReadOnlyIndicator",
  components: {
    LoadIcon,
  },
  props: {
    positionType: {
      type: String,
      default: 'absolute',
    }
  },
};
</script>

<style scoped>
.readonly-watermark {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  color: #c0c0c0;
  opacity: 0.25;
  pointer-events: none;
  user-select: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width:fit-content;
}

.readonly-watermark--sticky {
  position: sticky !important;
  transform: translate(-50%, -50%);
}
</style>
