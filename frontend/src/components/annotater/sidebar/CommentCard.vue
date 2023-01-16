<template>
  <div class="comment">
    <div v-if="edit">
        <textarea v-model="comment.text"
                  class="form-control"
                  placeholder="Enter text..."
                  @keydown.ctrl.enter="saveCard()">
        </textarea>
    </div>
    <div v-else-if="comment.text != null && comment.text.length > 0">
      <span v-if="nlp_active">&#128578;</span>
      {{ comment.text }}
    </div>
    <div v-else>
      <i>No comment</i>
    </div>
  </div>
  <TagSelector v-model="comment.tags" v-if="comment" :disabled="!edit" :isEditor="comment.userId === user_id"></TagSelector>
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
  data() {
    return {
      awaitingNlpResult: false
    }
  },
  sockets: {
    nlp_taskResults: function (data) {
      this.awaitingNlpResult = false;

    }
  },
  computed: {
    comment() {
      return this.$store.getters["comment/getComment"](this.comment_id);
    },
    user_id() {
      return this.$store.getters["auth/getUserId"];
    },
    nlp_active() {
      return this.$store.getters["settings/getValue"]("annotator.nlp.activated") === "true" &&
             this.$store.getters["nlp/getSkillConfig"]("sentiment_classification") !== null;
    },
  },
  methods: {
    save() {
      this.$socket.emit('updateComment', {
        "id": this.comment_id,
        "tags": JSON.stringify(this.comment.tags.sort()),
        "text": this.comment.text,
      });

      if(this.nlp_active){
        this.$socket.emit("skillRequest", {
          id: this.comment_id,
          name: "sentiment_classification",
          data: {text: this.comment.text}
        });
        this.awaitingNlpResult = true;
      }
    },
    saveCard() {
      this.$emit("saveCard");
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