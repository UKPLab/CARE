<template>
  <div
      v-if="loading"
      class="d-flex flex-column align-items-center justify-content-center"
  >
    <div class="row">
      <div
          class="spinner-border"
          :class="textClass"
          role="status"
          :style="'width:' + size + 'rem;height:'+ size + 'rem;'"
      >
        <span class="visually-hidden">{{ displayText }}</span>
      </div>
    </div>
    <div class="row">
      <strong :class="textClass" :style="'font-size:' + size / 2 + 'rem;'">{{ displayText }}</strong>
    </div>
  </div>
</template>

<script>

/**
 * Default loader component
 *
 * Include e.g.:
 *
 *    <Loader :loading="isLoading" />
 *    ...
 *    isLoading = false;
 *
 * @author: Dennis Zyska, Nils Dycke
 */
export default {
  name: "BasicLoading",
  props: {
    'loading': {
      type: Boolean,
      required: false,
      default: true
    },
    'text': {
      type: String,
      required: false,
      default: null
    },
    'textClass': {
      type: String,
      required: false,
      default: "text-dark"
    },
    'size': {
      type: Number,
      required: false,
      default: 3,
    }
  },
  computed: {
    displayText() {
      return this.text ? this.text : this.$t('common.loading');
    }
  }
}
</script>

<style scoped>

</style>