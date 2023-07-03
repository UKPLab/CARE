<template>
  <div class="card">
    <div
      class="card-header d-flex justify-content-between align-items-center"
      :style="{cursor: collapsable ? 'pointer' : 'auto'}"
      @click="toggleCollabs()"
    >
      <h5 class="card-title">
        {{ title }}
      </h5>
      <div>
        <slot name="headerElements" />
        <span v-if="collapsable">
          <LoadIcon
            color="grey"
            class="me-1"
            :icon-name="isCollapsed ? 'arrow-down-short' : 'arrow-up-short'"
          />
        </span>
      </div>
    </div>
    <TransitionGroup name="fade">
      <div
        v-if="!isCollapsed"
        class="card-body"
      >
        <slot name="body" />
      </div>
      <div
        v-if="!isCollapsed && $slots.footer"
        class="card-footer"
      >
        <slot name="footer" />
      </div>
    </TransitionGroup>
  </div>
</template>

<script>
import LoadIcon from "@/basic/icons/LoadIcon.vue";

/**
 * Basic card component for layouting
 *
 * Use this component to show a card with extra features including e.g. collapsing. Provides slots.
 *
 * @param {String} title - title of the card
 * @param {Boolean} collapsable - whether the card is collapsable or not
 *
 * @author: Dennis Zyska, Nils Dycke
 */
export default {
  name: "BasicCard",
  components: {LoadIcon},
  props: {
    title: {
      type: String,
      required: false,
      default: ""
    },
    collapsable: {
      type: Boolean,
      required: false,
      default: false
    },
    collapsed: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  emits: ["collapse"],
  data() {
    return {
      isCollapsed : false
    }
  },
  beforeMount() {
    this.isCollapsed = this.collapsed;
  },
  methods: {
    setCollapseState(collapse){
      this.isCollapsed = collapse;
    },
    toggleCollabs(){
      if(this.collapsable){
        this.isCollapsed = !this.isCollapsed;
        this.$emit("collapse", this.isCollapsed);
      }
    }
  }
}
</script>

<style scoped>

</style>