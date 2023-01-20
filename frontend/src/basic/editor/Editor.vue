<template>
  <div class="card border-1 text-start">
    <span class="text-start p-1 card-header" >
        <button class="btn  btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
          Paragraph
        </button>
        <ul class="dropdown-menu">
          <li><button @click="editor.chain().focus().toggleHeading({ level: 1 }).run()" class="dropdown-item">Heading 1</button></li>
          <li><button @click="editor.chain().focus().toggleHeading({ level: 2 }).run()" class="dropdown-item">Heading 2</button></li>
          <li><button @click="editor.chain().focus().toggleHeading({ level: 3 }).run()" class="dropdown-item">Heading 3</button></li>
        </ul>

      <LoadIcon class="mx-1" @click="editor.chain().focus().toggleBold().run()" iconName="type-bold"/>
      <LoadIcon class="mx-1" @click="editor.chain().focus().toggleItalic().run()" iconName="type-italic"/>
      <LoadIcon class="mx-1" @click="editor.chain().focus().toggleStrike().run()" iconName="type-strikethrough"/>
      <LoadIcon class="mx-1" @click="editor.chain().focus().toggleCode().run()" iconName="code"/>
      <LoadIcon class="mx-1" @click="editor.chain().focus().toggleCodeBlock().run()" iconName="code-square"/>
      <LoadIcon class="mx-1" @click="editor.chain().focus().toggleBulletList().run()" iconName="list-ul"/>
      <LoadIcon class="mx-1" @click="editor.chain().focus().toggleOrderedList().run()" iconName="list-ol"/>
      <LoadIcon class="ml-1" @click="editor.chain().focus().toggleBlockquote().run()" iconName="blockquote-left" />
    </span>
    <div class="card-body">
      <editor-content :editor="editor"/>
    </div>
  </div>
</template>

<script>
import {Editor, EditorContent} from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import LoadIcon from "@/icons/LoadIcon.vue";

export default {
  name: "Editor",
  data: function () {
    return {
      editor: null,
    }
  },
  components: {
    LoadIcon,
    EditorContent,
  },
  props: {
    content: {
      type: String,
      required: false,
      default: "",
    }
  },
  watch: {
    content: function (newContent) {
      this.editor.commands.setContent(newContent);
    }
  },
  beforeUnmount() {
    this.editor.destroy()
  },
  mounted() {
    this.editor = new Editor({
      content: this.content,
      extensions: [
        StarterKit,
      ],
    })
  },
}
</script>

<style scoped>

</style>