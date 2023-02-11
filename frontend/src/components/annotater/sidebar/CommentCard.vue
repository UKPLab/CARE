<template>
  <div v-if="level >= 1" class="mb-1">
    <div class="container-fluid">
      <div class="row">
        <div class="col">
          <LoadIcon :iconName="(collapseComment) ? 'chevron-right' : 'chevron-down'" size=12
                    @click="collapseComment = !collapseComment"></LoadIcon>

          {{ comment.creator_name }}
          <Collaboration ref="collab" :document-id="documentId" :target-id="commentId" target-type="comment"
                         @collabStatus="x => editMode = x"></Collaboration>
        </div>
        <div class="col text-end">
          {{ new Date(comment.updatedAt).toLocaleDateString() }}
        </div>
      </div>

    </div>
  </div>
  <div v-if="!collapseComment"
       :class="{blockquoteMain: comment.annotationId, blockquoteSub: !comment.referenceAnnotation}"
       class="comment card-text blockquote pb-1">


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

    <TagSelector v-if="comment" v-model="comment.tags" :disabled="!edit"
                 :isEditor="comment.userId === user_id"></TagSelector>
    <div v-if="level >= 1">
      <div class="ms-auto">
        <div v-if="editedByMyself" class="row">
          <div v-if="!readonly" class="col text-end">
            <SidebarButton
                :loading="false"
                :props="this.$props"
                icon="save-fill"
                title="Edit"
                @click="save"/>
            <SidebarButton
                :loading="false"
                :props="this.$props"
                icon="x-square-fill"
                title="Cancel"
                @click="cancel"/>
          </div>
        </div>
        <div v-else class="row">
          <div v-if="!readonly" class="col text-end">
            <SidebarButton v-if="settingResponse"
                           :loading="false"
                           :props="this.$props"
                           icon="reply-fill"
                           title="Reply"
                           @click="reply"/>
            <SidebarButton v-if="comment.userId === user_id"
                           :loading="false"
                           :props="this.$props"
                           icon="pencil-square"
                           title="Edit"
                           @click="editComment"/>
            <SidebarButton v-if="comment.userId === user_id || myBotRequest"
                           :loading="false"
                           :props="this.$props"
                           icon="trash3"
                           title="Delete"
                           @click="remove"/>
          </div>
        </div>
      </div>
    </div>
    <span v-for="c in childComments" v-if="level >= 1" :key="c.id">
          <hr class="hr"/>
          <CommentCard :commentId="c.id" :documentId="documentId" :level="level + 1" :readonly="readonly" :study-session-id="studySessionId">
        </CommentCard>
        </span>
  </div>
</template>

<script>
import TagSelector from "./TagSelector.vue";
import IconLoading from "@/icons/IconLoading.vue";
import LoadIcon from "@/icons/LoadIcon.vue"
import Collaboration from "@/basic/Collaboration.vue"
import SidebarButton from "./SidebarButton.vue"

export default {
  name: "CommentCard",
  components: {TagSelector, SidebarButton, IconLoading, LoadIcon, Collaboration},
  emits: ["saveCard"],
  props: {
    'studySessionId': {
      type: Number,
      required: false,
      default: null
    },
    'commentId': {
      type: Number,
      required: true,
    },
    readonly: {
      type: Boolean,
      required: false,
      default: false,
    },
    'documentId': {
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
    },
  },
  mounted() {
    if (this.nlp_active && this.nlp_result === null && this.comment.text !== null) {
      this.requestNlpFeedback();
    }
    if (this.level <= 1 || this.comment.draft) {
      this.collapseComment = false;
    }
  },
  computed: {
    comment() {
      return this.$store.getters["comment/getComment"](this.commentId);
    },
    skills() {
      return this.$store.getters["service/getNLPSkills"];
    },
    settingResponse() {
      return this.$store.getters["settings/getValue"]('annotator.collab.response') === "true";
    },
    myBotRequest() {
      if (this.comment.creator_name === "Bot" && this.$store.getters["comment/getComment"](this.comment.commentId)["userId"] === this.user_id) {
        return true;
      } else {
        return false;
      }
    },
    user_id() {
      return this.$store.getters["auth/getUserId"];
    },
    editedByMyself() {
      return this.comment.draft || this.editMode;
    },
    childComments() {
      return this.$store.getters["comment/getCommentsByCommentId"](this.commentId);
    },
    nlp_active() {
      const conf = this.$store.getters["service/get"]("NLPService", "skillConfig");
      return this.$store.getters["settings/getValue"]("annotator.nlp.activated") === "true" && conf && "sentiment_classification" in conf;
    },
    nlp_result() {
      const res = this.$store.getters["service/get"]("NLPService", "skillResults");
      return res && this.commentId in res ? res[this.commentId] : null;
    }
  },
  methods: {
    save() {
      this.$socket.emit('commentUpdate', {
        "commentId": this.commentId,
        "tags": JSON.stringify(this.comment.tags.sort()),
        "text": this.comment.text,
      });
      if (this.$refs.collab) {
        this.$refs.collab.removeCollab();
      }

      // send to model upon save (regardless of the server response on the update (!))
      if (this.comment.text && this.nlp_active) {
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
      if (this.$refs.collab) {
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
        "documentId": this.documentId,
        "commentId": this.commentId,
        "studySessionId": this.studySessionId,
      });
    },
    saveCard() {
      this.$emit("saveCard");
    },

    requestNlpFeedback() {
      console.log("REQUESTING NLP!!!", this.comment);

      this.$socket.emit("serviceRequest",
          {
            service: "NLPService",
            data: {
              id: this.commentId,
              name: "sentiment_classification",
              data: {text: this.comment.text}
            }
          }
      );
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
  margin-left: 4px;
}

.blockquoteMain:hover {
  color: #000000;
}

</style>