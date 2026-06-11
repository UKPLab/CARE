<template>
  <Loader
    v-if="!template"
    :loading="true"
    class="pageLoader"
  />
  <span v-else>
    <Editor ref="editor" :template-id="templateIdNum"/>
  </span>
</template>
  
  <script>
  /**
   * Template editor view
   *
   * Loads a template and allows the user to edit its content using the Quill editor.
   * Only admins can access this view.
   *
   * @author Mohammad Elwan
   */
  
  import Loader from "@/basic/Loading.vue";
  import Editor from "@/components/editor/Editor.vue"
  
  export default {
    name: "TemplateRoute",
    subscribeTable: ["template"],
    components: {Loader, Editor},
    beforeRouteLeave(to, from, next) {
      const templateEditor = this.$refs.editor?.$refs?.templateEditor;
      if (!templateEditor || typeof templateEditor.requestClose !== "function") {
        next();
        return;
      }
      templateEditor.requestClose().then((res) => {
        if (res && res.success) {
          next();
        } else {
          if (res && !res.success) {
            this.eventBus.emit("toast", {
              title: "Template save failed",
              message: res.message || "",
              variant: "danger",
            });
          }
          next(false);
        }
      }).catch(() => next(false));
    },
    props: {
      'templateId': {
        type: [String, Number],
        required: true
      },
    },
    data() {
      return {
        templateIdNum: 0
      }
    },
    computed: {
      template() {
        return this.$store.getters["table/template/get"](this.templateIdNum);
      },
    },
    watch: {
      templateId: {
        immediate: true,
        handler(newVal) {
          if (newVal) {
            this.templateIdNum = Number(newVal);
          } else {
            this.templateIdNum = 0;
          }
        }
      },
      template(newVal) {
        if (newVal) {
          this.templateIdNum = newVal.id;
        } else {
          this.templateIdNum = 0;
        }
      },
    },
    mounted() {
      this.templateIdNum = Number(this.templateId);
      if (this.templateIdNum > 0) {
        this.$socket.emit("appData", {
          table: "template",
          filter: [{ key: "id", value: this.templateIdNum }],
        });
      }
    },
    sockets: {
      templateError: function (data) {
        if (data.templateId === this.templateIdNum) {
          this.eventBus.emit('toast', {
            title: "Template Error",
            message: data.message,
            variant: "danger"
          });
          this.$router.push("/dashboard/templates");
        }
      }
    },
    methods: {
    }
  }
  </script>
  
  <style scoped>
  .pageLoader {
    position: absolute;
    top: 25%;
    left: 50%;
    transform: translate(-50%, -50%)
  }
  </style>