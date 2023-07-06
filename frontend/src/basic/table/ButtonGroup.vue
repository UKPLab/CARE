<template>
  <div class="btn-group btn-group-sm">
    <TableButton
      v-for="b in buttons"
      :key="b"
      :action="b.action"
      :icon="b.icon"
      :options="b.options"
      :params="params"
      :title="b.title"
      @action="actionEmitter"
    />
  </div>
</template>

<script>
import TableButton from "./Button.vue";

export default {
  name: "ButtonGroup",
  components: {TableButton},
  props: {
    buttons: {
      type: Array,
      required: true
    },
    params: {
      type: Object,
      required: false,
      default: null
    }
  },
  emits: ['action'],
  methods: {
    actionEmitter(data){
      this.$emit('action', data);
    }
  }
}
</script>

<style scoped>
</style>