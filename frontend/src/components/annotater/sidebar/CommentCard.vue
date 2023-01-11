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
      {{ comment.text }}
    </div>
    <div v-else>
      <i>No comment</i>
    </div>
    <div class="text-end fw-light" title="Sentiment Analysis">
      <span v-if="nlp_active && awaitingNlpResult && !edit">
        <IconLoading></IconLoading>
      </span>
      <span v-else-if="nlp_active && nlp_result !== null">
        <span>
          {{nlp_result.score.toFixed(2) * 100}}%
        </span>
        <span v-if="nlp_result.label === 'neu'">
          &#129765;
        </span>
        <span v-else-if="nlp_result.label === 'pos'">
          &#128578;
        </span>
        <span v-else-if="nlp_result.label === 'neg'">
          &#9785;&#65039;
        </span>
      </span>
    </div>
  </div>
  <TagSelector v-model="comment.tags" v-if="comment" :disabled="!edit" :isEditor="comment.userId === user_id"></TagSelector>
</template>

<script>
import TagSelector from "./TagSelector.vue";
import IconLoading from "../../../icons/IconLoading.vue";

export default {
  name: "CommentCard",
  components: {TagSelector, IconLoading},
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
  watch: {
    nlp_result(newV, oldV) {
      if(this.nlp_active){
        this.awaitingNlpResult = newV === null;
      }
    },
    nlp_active(newV, oldV) {
      if(this.nlp_active && this.nlp_result === null){
        this.requestNlpFeedback();
      }
    }
  },
  mounted() {
    if(this.nlp_active && this.nlp_result === null){
      this.requestNlpFeedback();
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
    nlp_result() {
      return this.$store.getters["nlp/getTaskResult"](this.comment_id);
    }
  },
  methods: {
    save() {
      this.$socket.emit('updateComment', {
        "id": this.comment_id,
        "tags": JSON.stringify(this.comment.tags.sort()),
        "text": this.comment.text,
      });

      // send to model upon save (regardless of the server response on the update (!))
      if(this.nlp_active){
        this.requestNlpFeedback()
      }
    },
    saveCard() {
      this.$emit("saveCard");
    },
    requestNlpFeedback() {
      this.$socket.emit("nlp_skillRequest", {
          id: this.comment_id,
          name: "sentiment_classification",
          data: {text: this.comment.text}
        });
        this.awaitingNlpResult = true;
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