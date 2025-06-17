<template>
  <div class="text-placeholder">
    <p v-if="textContent">{{ textContent }}</p>
    <p v-else class="text-muted"> ~ Placeholder data missing ~ </p>
  </div>
</template>

<script>
/**
 * Text placeholder component to display dynamic text content.
 * 
 * @author: Manu Sundar Raj Nandyal
 */
export default {
  name: "Text",
  inject: {
    studyData: {
      type: Array,
      required: false,
      default: () => [],
    }
  },  
  props: {
    config: {
      type: Object,
      required: false,
      default: () => ({}),
    }
  },
  computed: {
    textContent() {
      if (!this.config?.input?.stepId || !this.config?.input?.dataSource) {
        return null;
      }
      
      const { stepId, dataSource } = this.config.input;
      if (!this.studyData[stepId]) {
        return null;
      }
      
      const textElement = Object.values(this.studyData[stepId]).find(item => item.key === dataSource);
      return textElement?.value || null;
    }
  }
};
</script>

<style scoped>
.text-placeholder {
  font-size: 1rem;
  line-height: 1.5;
  color: #212529;
  background-color: #ffffff;
  padding: 0.75rem 1rem;
  border-radius: 0.375rem;
  border: 1px solid #dee2e6;
}
</style>
