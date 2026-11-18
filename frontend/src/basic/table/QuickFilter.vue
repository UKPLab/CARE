<template>
  <div class="input-group input-group-sm">
    <span
      id="search-addon1"
      class="input-group-text"
    >
      <BasicIcon icon-name="search"></BasicIcon>
    </span>
    <input
      v-model="text"
      type="text"
      class="form-control"
      :placeholder="$t('common.typeToFilter')"
      aria-label="table-search"
      aria-describedby="search-addon1"
    />
    <slot />
  </div>
</template>

<script>
import BasicIcon from "@/basic/Icon.vue";

/**
 * Free-text filter bar of BasicTable (Table.vue); the table filters its rows by this text.
 * The default slot takes extra buttons next to the input.
 */
export default {
  name: "BasicTableQuickFilter",
  components: { BasicIcon },
  props: {
    modelValue: {
      type: String,
      required: false,
      default: "",
    },
  },
  emits: ["update:modelValue"],
  computed: {
    text: {
      get() {
        return this.modelValue;
      },
      set(value) {
        this.$emit("update:modelValue", value);
      },
    },
  },
};
</script>
