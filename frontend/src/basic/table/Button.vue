<template>
  <button class="btn" :class="buttonClass.specifiers" type="button" @click="this.onClickWithContext()" :title="this.title">
    <LoadIcon v-if="this.icon !== null" :iconName="this.icon"></LoadIcon>
    <span v-if="this.icon === null || !this.buttonClass.iconOnly">{{this.title}}</span>
  </button>
</template>

<script>
import LoadIcon from "@/icons/LoadIcon.vue";

export default {
  name: "TableButton.vue",
  components: {LoadIcon},
  props: {
    onClick: {
      type: Function,
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
      type: Array,
      required: false,
      default: []
    }
  },
  data: function () {
    return {
      buttonClass: {
        iconOnly: this.options && this.options.iconOnly,
        specifiers: this.options && this.options.specifiers
      }
    }
  },
  methods: {
    onClickWithContext(){
      this.onClick(...this.params);
    }
  }
}
</script>

<style scoped>
</style>