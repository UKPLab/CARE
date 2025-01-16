<template>
  <div class="btn-group btn-group-sm">
    <TableButton
      v-for="b in showButtons"
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
  computed: {
    showButtons() {
      return this.buttons.filter(b => {
        if (b.filter) {
          return b.filter.some(f => {
            if (f.type === "not") {
              return this.params[f.key] !== f.value;
            } else {
              return this.params[f.key] === f.value;
            }
          });
        }
        return true;
      });
    }
  },
  methods: {
    actionEmitter(data) {
      this.$emit('action', data);
    }
  }
}
</script>

<style scoped>
</style>