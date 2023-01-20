<template>
  <div v-if="level >= 1" class="mb-1">
    <div class="container-fluid">
      <div class="row">
        <div class="col">
          <LoadIcon size=12 :iconName="(collapseComment) ? 'chevron-right' : 'chevron-down'" @click="collapseComment = !collapseComment"></LoadIcon>

          {{ comment.creator_name }}
          <!--<span v-if="showEditByCollab">
            <LoadIcon :size="12 " class="fading" iconName="pencil-fill"></LoadIcon>
          </span>-->
          <Collaboration ref="collab" :document-id="document_id" :target-id="comment_id" target-type="comment"
                         @collabStatus="x => editMode = x"></Collaboration>
        </div>
        <div class="col text-end">
          {{ new Date(comment.updatedAt).toLocaleDateString() }}
        </div>
      </div>

    </div>
  </div>
  <div v-if="!collapseComment" class="comment card-text blockquote pb-1" :class="{blockquoteMain: comment.referenceAnnotation, blockquoteSub: !comment.referenceAnnotation}">


    <div v-if="edit || editedByMyself">
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
          {{ nlp_result.score.toFixed(2) * 100 }}%
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

    <TagSelector v-model="comment.tags" v-if="comment" :disabled="!edit"
                 :isEditor="comment.userId === user_id"></TagSelector>
    <div v-if="level >= 1">
      <div class="ms-auto">
        <div v-if="editedByMyself" class="row">
          <div class="col text-end">
            <button class="btn btn-sm" data-placement="top" data-toggle="tooltip" title="Save"
                    type="button" v-on:click="save()">
              <LoadIcon :size="16" class="danger" iconName="save-fill"></LoadIcon>
              <span class="visually-hidden">Edit</span>
            </button>
            <button class="btn btn-sm" data-placement="top" data-toggle="tooltip" title="Cancel"
                    type="button" v-on:click="cancel()">
              <LoadIcon :size="16" iconName="x-square-fill"></LoadIcon>
              <span class="visually-hidden">Edit</span>
            </button>
          </div>
        </div>
        <div v-else class="row">
          <div class="col text-end">
            <button v-if="settingResponse" class="btn btn-sm" data-placement="top" data-toggle="tooltip" title="Reply"
                    type="button" v-on:click="reply()">
              <LoadIcon :size="16" iconName="reply-fill"></LoadIcon>
              <span class="visually-hidden">Reply</span>
            </button>
            <button class="btn btn-sm" data-placement="top" data-toggle="tooltip" title="Edit"
                    type="button" v-on:click="editComment()">
              <LoadIcon :size="16" iconName="pencil-square"></LoadIcon>
              <span class="visually-hidden">Edit</span>
            </button>
            <button class="btn btn-sm" data-placement="top" data-toggle="tooltip"
                    title="Delete"
                    type="button" v-on:click="remove()">
              <LoadIcon :size="16" iconName="trash3"></LoadIcon>
              <span class="visually-hidden">Delete</span>
            </button>
          </div>
        </div>
      </div>
    </div>
        <span  v-if="level >= 1"  v-for="c in childComments" :key="c.id">
          <hr class="hr"/>
          <CommentCard :document_id="document_id" :comment_id="c.id" :level="level + 1">
        </CommentCard>
        </span>
  </div>
</template>

<script>
import TagSelector from "./TagSelector.vue";
import IconLoading from "@/icons/IconLoading.vue";
import LoadIcon from "@/icons/LoadIcon.vue"
import Collaboration from "@/basic/Collaboration.vue"

export default {
  name: "CommentCard",
  components: {TagSelector, IconLoading, LoadIcon, Collaboration},
  emits: ["saveCard"],
  props: {
    comment_id: {
      type: Number,
      required: true
    },
    document_id: {
      type: Number,
      required: true
    },
    edit: {
      type: Boolean,
      required: false,
      default: false,
    },
    level: {
      type: Number,
      require: false,
      default: 1,
    }
  },
  data() {
    return {
      awaitingNlpResult: false,
      editMode: false,
      collapseComment: true,
    }
  },
  watch: {
    nlp_result(newV, oldV) {
      if (this.nlp_active) {
        this.awaitingNlpResult = newV === null;
      }
    },
    nlp_active(newV, oldV) {
      if (this.nlp_active && this.nlp_result === null) {
        this.requestNlpFeedback();
      }
    }
  },
  mounted() {
    if (this.nlp_active && this.nlp_result === null) {
      this.requestNlpFeedback();
    }
    if (this.level <= 1 || this.comment.draft) {
      this.collapseComment = false;
    }
  },
  computed: {
    comment() {
      return this.$store.getters["comment/getComment"](this.comment_id);
    },
    settingResponse() {
      return this.$store.getters["settings/getValue"]('annotator.collab.response') === "true";
    },
    user_id() {
      return this.$store.getters["auth/getUserId"];
    },
    editedByMyself() {
      return this.comment.draft || this.editMode;
    },
    childComments() {
      return this.$store.getters["comment/getCommentsByCommentId"](this.comment_id);
    },
    nlp_active() {
      return this.$store.getters["settings/getValue"]("annotator.nlp.activated") === "true" &&
          this.$store.getters["nlp/getSkillConfig"]("sentiment_classification") !== null;
    },
    nlp_result() {
      return this.$store.getters["nlp/getSkillResult"](this.comment_id);
    }
  },
  methods: {
    save() {
      this.$socket.emit('commentUpdate', {
        "commentId": this.comment_id,
        "tags": JSON.stringify(this.comment.tags.sort()),
        "text": this.comment.text,
      });
      if(this.$refs.collab){
        this.$refs.collab.removeCollab();
      }

      // send to model upon save (regardless of the server response on the update (!))
      if (this.nlp_active) {
        this.requestNlpFeedback()
      }
    },
    cancel() {
      if (this.comment.draft) {
        this.remove();
      } else {
        this.$socket.emit('commentGet', {
          "commentId": this.comment.id,
        });
      }
      if(this.$refs.collab) {
        this.$refs.collab.removeCollab();
      }
      this.edit_mode = null;
    },
    remove() {
      this.$socket.emit('commentUpdate', {
        "commentId": this.comment.id,
        "deleted": true
      });
    },
    editComment() {
      this.$refs.collab.startCollab();
    },
    reply() {
      this.$socket.emit('commentAdd', {
        "documentId": this.document_id,
        "commentId": this.comment_id
      });
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

.blockquote {
  padding-right: 0;

}
.blockquoteSub {
    margin-left:4px;
}
.blockquoteMain:hover {
  color: #000000;
}

</style>