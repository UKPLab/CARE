<template>
  <blockquote
    class="blockquote fs-6"
    v-show="modelValue">
    <div ref="content"/>
  </blockquote>
  <Loader
    v-show="!modelValue"
    :loading="!modelValue"
  />
</template>

<script>

import Loader from "@/basic/Loader.vue";
import jsonview from "@pgrabovets/json-view";

/* JsonEditor.vue - default component for a JSON editor

Use this component to show a text editor with basic markdown features.

Author: Nils Dycke
Source: -
*/
export default {
  name: "JsonEditor",
  components: {
    Loader
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
      jsonTree: null
    }
  },
  watch: {
    modelValue: function (newContent) {
      this.updateJson(newContent);
    }
  },
  beforeUnmount() {
    if(this.jsonTree)
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

      console.log(this.jsonTree);
      if(this.jsonTree.children.length < 3){
        jsonview.expand(this.jsonTree);
        this.jsonTree.children.forEach(c => {
          if(c.children && c.children.length > 1){
            jsonview.collapse(c);
          }
          c.children.forEach(c2 => jsonview.collapse(c2));
        });
      }
    }
  }
}
</script>

<style>
blockquote div .json-container {
  all:inherit;
}
blockquote {
  border-width:1px;
}
</style>