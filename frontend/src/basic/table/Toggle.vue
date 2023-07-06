<template>
  <div class="form-check form-switch">
    <input
      ref="switch"
      class="form-check-input"
      :class="buttonClass.specifiers"
      :title="title"
      type="checkbox"
      role="switch"
      :checked="value"
      @input="actionEmitter"
    >
  </div>
</template>

<script>

export default {
  name: "TableToggle",
  components: {},
  props: {
    action: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    value: {
      type: Boolean,
      required: true
    },
    options: {
      type: Object,
      required: false
    },
    params: {
      type: Object,
      required: false,
    }
  },
  emits: ['action'],
  data: function () {
    return {
      buttonClass: {
        specifiers: this.options && this.options.specifiers
      }
    }
  },
  methods: {
    actionEmitter() {
      this.$emit('action', {action: this.action, params: this.params, value: !this.value});
    }
  }
}
</script>

<style scoped>
</style>