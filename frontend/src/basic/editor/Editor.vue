<template>
  <div class="card border-1 text-start">
    <span class="text-start p-1 card-header">
      <button
        aria-expanded="false"
        class="btn  btn-sm dropdown-toggle"
        data-bs-toggle="dropdown"
        type="button"
      >
        Paragraph
      </button>
      <ul class="dropdown-menu">
        <li><button type="button"
          class="dropdown-item"
          @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
        >Heading 1</button></li>
        <li><button type="button"
          class="dropdown-item"
          @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
        >Heading 2</button></li>
        <li><button type="button"
          class="dropdown-item"
          @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
        >Heading 3</button></li>
      </ul>

      <LoadIcon
        class="mx-1"
        icon-name="type-bold"
        @click="editor.chain().focus().toggleBold().run()"
      />
      <LoadIcon
        class="mx-1"
        icon-name="type-italic"
        @click="editor.chain().focus().toggleItalic().run()"
      />
      <LoadIcon
        class="mx-1"
        icon-name="type-strikethrough"
        @click="editor.chain().focus().toggleStrike().run()"
      />
      <LoadIcon
        class="mx-1"
        icon-name="code"
        @click="editor.chain().focus().toggleCode().run()"
      />
      <LoadIcon
        class="mx-1"
        icon-name="code-square"
        @click="editor.chain().focus().toggleCodeBlock().run()"
      />
      <LoadIcon
        class="mx-1"
        icon-name="list-ul"
        @click="editor.chain().focus().toggleBulletList().run()"
      />
      <LoadIcon
        class="mx-1"
        icon-name="list-ol"
        @click="editor.chain().focus().toggleOrderedList().run()"
      />
      <LoadIcon
        class="ml-1"
        icon-name="blockquote-left"
        @click="editor.chain().focus().toggleBlockquote().run()"
      />
    </span>
    <div class="card-body">
      <editor-content :editor="editor" />
    </div>
  </div>
</template>

<script>
import {Editor, EditorContent} from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import LoadIcon from "@/icons/LoadIcon.vue";

/**
 * Editor.vue - default component for a markdown text editor
 *
 * Use this component to show a text editor with basic markdown features.
 *
 * @author: Dennis Zyska
 */
export default {
  name: "BasicEditor",
  components: {
    LoadIcon,
    EditorContent,
  },
  props: {
    modelValue: {
      type: String,
      required: true
    },
  },
  emits: ["update:modelValue"],
  data: function () {
    return {
      editor: null,
    }
  },
  watch: {
    modelValue: function (newContent) {
      if (this.editor.getHTML() !== newContent)
        this.editor.commands.setContent(newContent);
    }
  },
  beforeUnmount() {
    this.editor.destroy()
  },
  mounted() {
    this.editor = new Editor({
      content: this.modelValue,
      extensions: [
        StarterKit,
      ],
      parseOptions: {
        preserveWhitespace: "full"
      }

    });
    this.editor.on('update', ({editor}) => {
      this.$emit("update:modelValue", editor.getHTML());
    })
  },
}
</script>

<style scoped>
.ProseMirror * {
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>