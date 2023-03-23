<template>
  <blockquote
      v-show="modelValue"
      class="blockquote fs-6 position-relative"
      @mouseover="showCopyButton=true"
      @mouseleave="showCopyButton=false"
  >
    <div
        ref="content"
        class="bg-light border-start"
    >
      <button
          v-show="showCopyButton"
          class="btn position-absolute top-0 end-0 opacity-50"
          @click="copy"
      >
        <LoadIcon
            class="me-1"
            :size="16"
            icon-name="clipboard"
        />
        <span class="fw-light"> Copy </span>
      </button>
    </div>
  </blockquote>
  <Loader
      v-show="!modelValue"
      :loading="!modelValue"
  />
</template>

<script>

import Loader from "@/basic/Loader.vue";
import jsonview from "@pgrabovets/json-view";
import LoadIcon from "@/icons/LoadIcon.vue";

/* JsonEditor.vue - default component for a JSON editor

Use this component to show a text editor with basic markdown features.

Author: Nils Dycke
Source: -
*/
export default {
  name: "JsonEditor",
  components: {
    Loader,
    LoadIcon
  },
  props: {
    modelValue: {
      type: Object,
      required: true
    },
    readonly: {
      type: Boolean,
      required: false,
      default: true
    }
  },
  emits: ["update:modelValue"],
  data: function () {
    return {
      jsonTree: null,
      showCopyButton: false
    }
  },
  watch: {
    modelValue: function (newContent) {
      this.updateJson(newContent);
    }
  },
  beforeUnmount() {
    if (this.jsonTree)
      jsonview.destroy(this.jsonTree)
  },
  mounted() {
    this.updateJson(this.modelValue);
  },
  methods: {
    updateJson(data) {
      const newTree = jsonview.create(data);

      if (this.jsonTree) {
        jsonview.destroy(this.jsonTree);
      }

      jsonview.render(newTree, this.$refs.content);
      this.jsonTree = newTree;

      jsonview.expand(this.jsonTree);
      this.jsonTree.children.forEach(c => {
        if (c.children && c.children.length > 1) {
          jsonview.collapse(c);
        }
        c.children.forEach(c2 => jsonview.collapse(c2));
      });
    },
    async copy() {
      if (this.modelValue) {
        try {
          await navigator.clipboard.writeText(JSON.stringify(this.modelValue, null, 2));
          this.eventBus.emit('toast', {
            title: "Json copied",
            message: "Json copied to clipboard!",
            variant: "success"
          });
        } catch ($e) {
          this.eventBus.emit('toast', {
            title: "Json not copied",
            message: "Could not copy json to clipboard!",
            variant: "danger"
          });
        }
      } else {
        this.eventBus.emit('toast', {
          title: "Json not copied",
          message: "Json not loaded or empty, cannot copy.",
          variant: "danger"
        });
      }
    }
  }
}
</script>

<style>
blockquote div .json-container {
  all: inherit;
}

blockquote {
  border-width: 1px;
}


</style>