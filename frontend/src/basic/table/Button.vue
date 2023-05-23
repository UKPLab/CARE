<template>
  <button
    class="btn btn-sm"
    :class="buttonClass.specifiers"
    type="button"
    :title="title"
    @click="actionEmitter"
  >
    <LoadIcon
      v-if="icon !== null"
      :icon-name="icon"
      :size="16"
    />
    <span v-if="icon === null || !buttonClass.iconOnly">{{ title }}</span>
  </button>
</template>

<script>
import LoadIcon from "@/icons/LoadIcon.vue";

export default {
  name: "TableButton",
  components: {LoadIcon},
  props: {
    action: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    icon: {
      type: String,
      required: false,
      default: null
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
        iconOnly: this.options && this.options.iconOnly,
        specifiers: this.options && this.options.specifiers
      },
    }
  },
  methods: {
    actionEmitter(){
      this.$emit('action', {action: this.action, params: this.params});
    }
  }
}
</script>

<style scoped>
</style>