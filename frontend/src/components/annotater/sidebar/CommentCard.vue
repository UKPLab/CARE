<template>
  <div class="comment">
    <div v-if="edit">
        <textarea v-model="annoComment"
                  class="form-control"
                  placeholder="Enter text..."
                  @keydown.ctrl.enter="submit()">
        </textarea>
    </div>
    <div v-else-if="comment != null && comment.length > 0">
      {{ comment }}
    </div>
    <div v-else>
      <i>No comment</i>
    </div>
  </div>
  <TagSelector v-model="tags" v-if="comment"></TagSelector>
</template>

<script>
import TagSelector from "./TagSelector.vue";

export default {
  name: "CommentCard",
  components: {TagSelector},
  props: {
    comment_id: {
      type: Number,
      required: false,
      default: null,
    },
    edit: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  computed: {
    comment() {
      return this.$store.getters["comment/getComment"](this.comment_id);
    },
    tags() {
      return this.comment.tags;
    }
  },
  methods: {
    save() {
      this.$socket.emit('updateComment', {
        "id": this.comment_id,
        "tags": JSON.stringify(this.tags.sort()),
        "text": this.comment.text,
      });
    }
  }
}
</script>

<style scoped>
.comment {
  color: #666666;
  font-style: normal;
}
</style>