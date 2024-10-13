<template>
    <Teleport to="#topbarCustomPlaceholder">   
        <button
        :title="title"
        class="btn"
        type="button"
        :disabled="disabled"
        @click="action"
        >
        <LoadIcon
            v-if="icon"
            :icon-name="icon"
        />
        <span><slot>{{ buttonText }}</slot></span>
        </button>
    </Teleport>
  </template>
  
  <script>
  import LoadIcon from "@/basic/Icon.vue";
  
  export default {
    name: "TopBarButton",
    components: {LoadIcon},
    inject: {
      acceptStats: {
        default: () => false
      }
    },
    props: {
      icon: {
        type: String,
        required: false,
        default: null
      },
      title: {
        type: String,
        required: false,
        default: null
      },
      "props": {
        type: Object,
        required: false,
        default: null
      },
      text: {
        type: String,
        required: false,
        default: null
      },
      disabled: {
      type: Boolean,
      required: false,
      default: false
    }
    },
    emits: ["click"],
    computed: {
      buttonText() {
        return this.text ? this.text : this.title
      }
    },
    methods: {
      action() {
        this.$emit("click")
        if (this.acceptStats) {
          this.$socket.emit("stats", {
            action: "clickTopBarButton",
            data: {"title": this.title, "icon": this.icon, "props": this.props}
          });
        }
      }
    }
  }
  </script>
  
  <style scoped>
  
  </style>