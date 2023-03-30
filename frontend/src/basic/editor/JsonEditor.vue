<template>
  <blockquote
      ref="top"
      v-show="content"
      class="blockquote fs-6 position-relative"
      @mouseover="showCopyButton=true"
      @mouseleave="showCopyButton=false"
  >
    <div
        ref="content"
        class="bg-light border-start"
        @dblclick="editMode=!readonly"
    >
      <button
          v-show="showCopyButton && !editMode"
          class="btn position-absolute top-0 end-0 opacity-50"
          @click="(e) => {e.stopPropagation(); copy()}"
      >
        <LoadIcon
            class="me-1"
            :size="16"
            icon-name="clipboard"
        />
        <span class="fw-light"> Copy </span>
      </button>
      <form v-if="editMode">
        <textarea :rows="contentText.split('\n').length" v-model="contentText" class="code form-check-input w-100 h-100" title="Edit JSON" type="text"> </textarea>
      </form>
    </div>
  </blockquote>
  <Loader
      v-show="!content"
      :loading="!content"
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
    content: {
      type: Object,
      required: true
    },
    readonly: {
      type: Boolean,
      required: false,
      default: false
    },
    startEditMode: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  emits: ["update:content"],
  data: function () {
    return {
      jsonTree: null,
      showCopyButton: false,
      editMode: false,
      leaveEditModeListener: null,
      contentText: null
    }
  },
  watch: {
    content(newVal) {
      this.contentText = JSON.stringify(newVal, null, 2);
      this.updateJson(newVal);
    },
    editMode(newVal, oldVal) {
      if (newVal && !oldVal) {
        this.cleanJson();
        window.addEventListener("click", this.leaveEditModeListener);
      } else if (!newVal && oldVal) {
        window.removeEventListener("click", this.leaveEditModeListener);
        this.$emit("update:content", JSON.parse(this.contentText));
      }
    }
  },
  beforeMount() {
    this.contentText = JSON.stringify(this.content, null, 2);

    const self = this;
    this.leaveEditModeListener = function (e) {
      if (self.editMode && self.$refs.top !== e.target && !self.$refs.top.contains(e.target)) {
        self.editMode = false;
      }
    }
  },
  beforeUnmount() {
    if (this.jsonTree)
      jsonview.destroy(this.jsonTree)

    try {
      window.removeEventListener("click", this.leaveEditModeListener);
    } catch (e) {
      // do nothing
    }
  },
  mounted() {
    this.updateJson(this.content);
    if(this.startEditMode){
      this.editMode = true;
    }
  },
  methods: {
    validContentText(){
      try {
        JSON.parse(this.contentText);
        return true;
      } catch (e) {
        return false;
      }
    },
    updateJson(data) {
      const newTree = jsonview.create(data);

      this.cleanJson();
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
    cleanJson() {
      if (this.jsonTree) {
        jsonview.destroy(this.jsonTree);
        this.jsonTree = null;
      }
    },
    async copy() {
      if (this.content) {
        try {
          await navigator.clipboard.writeText(JSON.stringify(this.content, null, 2));
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