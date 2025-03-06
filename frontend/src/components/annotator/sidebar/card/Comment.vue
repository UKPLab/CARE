<template>
  <div
    v-if="level >= 1"
    class="mb-1"
  >
    <div class="container-fluid">
      <div class="row">
        <div class="col">
          <LoadIcon
            :icon-name="(collapseComment) ? 'chevron-right' : 'chevron-down'"
            :size="12"
            @click="collapseComment = !collapseComment"
          />

          {{ comment.creator_name }}
          <Collaboration
            ref="collab"
            :document-id="documentId"
            :target-id="commentId"
            target-type="comment"
            @collab-status="toEditMode"
          />
        </div>
        <div class="col text-end">
          {{ new Date(comment.updatedAt).toLocaleDateString() }}
        </div>
      </div>
    </div>
  </div>
  <div
    v-if="!collapseComment"
    :class="{blockquoteMain: comment.annotationId, blockquoteSub: !comment.referenceAnnotation}"
    class="comment card-text blockquote pb-1"
  >
    <div v-if="edit || editedByMyself">
      <textarea
        ref="textarea"
        v-model="comment.text"
        class="form-control"
        placeholder="Enter text..."
        @keydown.ctrl.enter="saveOnDeactivated(false)"
        @paste="onPaste"
      />
    </div>
    <div v-else-if="comment.text != null && comment.text.length > 0">
      {{ comment.text }}
    </div>
    <div v-else>
      <i>No comment</i>
    </div>
    <div
      class="text-end fw-light"
      title="Sentiment Analysis"
    >
      <span v-if="nlp_active && awaitingNlpResult && !edit">
        <IconLoading/>
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

    <TagSelector
      v-if="comment"
      v-model="comment.tags"
      :disabled="!edit"
      :is-editor="comment.userId === userId"
    />
    <div v-if="level >= 1">
      <div class="ms-auto">
        <div
          v-if="editedByMyself"
          class="row"
        >
          <div
            v-if="!readonly"
            class="col text-end"
          >
            <SidebarButton
              :loading="false"
              :props="$props"
              icon="save-fill"
              title="Save (Ctrl+Enter)"
              @click="save"
            />
            <SidebarButton
              :loading="false"
              :props="$props"
              icon="x-square-fill"
              title="Cancel"
              @click="cancel"
            />
          </div>
        </div>
        <div
          v-else
          class="row"
        >
          <div
            class="col text-end"
          >
            <SidebarButton
              v-if="settingResponse && !readonly"
              :loading="false"
              :props="$props"
              icon="reply-fill"
              title="Reply"
              @click="reply"
            />
            <VoteButtons :comment="comment"/>
            <SidebarButton
              v-if="comment.userId === userId && !readonly"
              :loading="false"
              :props="$props"
              icon="pencil-square"
              title="Edit"
              @click="editComment"
            />
            <SidebarButton
              v-if="(comment.userId === userId || myBotRequest) && !readonly"
              :loading="false"
              :props="$props"
              icon="trash3"
              title="Delete"
              @click="remove"
            />
          </div>
        </div>
      </div>
    </div>
    <span v-if="level >= 1">
      <span
        v-for="c in childComments"
        :key="c.id"
      >
        <hr class="hr">
        <CommentCard
          :comment-id="c.id"
          :level="level + 1"
        />
    </span>
    </span>
  </div>
</template>

<script>
import TagSelector from "./TagSelector.vue";
import IconLoading from "@/basic/icons/IconLoading.vue";
import LoadIcon from "@/basic/Icon.vue"
import Collaboration from "@/basic/Collaboration.vue"
import SidebarButton from "./Button.vue"
import VoteButtons from "@/components/annotator/sidebar/card/VoteButtons.vue";

/**
 * Comment card in the sidebar
 *
 * SideCard, which contains only a comment, but no annotation.
 *
 * @author: Nils Dycke, Dennis Zyska
 */
export default {
  name: "CommentCard",
  components: {VoteButtons, TagSelector, SidebarButton, IconLoading, LoadIcon, Collaboration},
  inject: {
    documentId: {
      type: Number,
      required: true,
    },
    studySessionId: {
      type: Number,
      required: false,
      default: null,
    },
    studyStepId: {
      type: Number,
      required: false,
      default: null,
    },
    readonly: {
      type: Boolean,
      required: false,
      default: false,
    },
    listenOnActive: {
      type: Function,
      required: true,
    },
    unlistenOnActive: {
      type: Function,
      required: true,
    },
    acceptStats: {
      default: () => false
    }
  },
  props: {
    'commentId': {
      type: Number,
      required: true,
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
  emits: ["saveCard"],
  data() {
    return {
      awaitingNlpResult: false,
      editMode: false,
      collapseComment: true,
      listeningToFocus: false
    }
  },
  computed: {
    comment() {
      return this.$store.getters["table/comment/get"](this.commentId);
    },
    skills() {
      return this.$store.getters["service/getSkills"]("NLPService");
    },
    settingResponse() {
      return this.$store.getters["settings/getValue"]('annotator.collab.response') === "true";
    },
    myBotRequest() {
      return this.comment.creator_name === "Bot"
        && this.$store.getters["table/comment/get"](this.comment.parentCommentId).userId === this.userId;
    },
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    editedByMyself() {
      return (this.comment) ? this.comment.draft || this.editMode || this.edit : false;
    },
    childComments() {
      return this.$store.getters["table/comment/getByKey"]("parentCommentId", this.commentId)
        .sort(
          function (a, b) {
            let keyA = new Date(a.createdAt), keyB = new Date(b.createdAt);
            if (keyA < keyB) return -1;
            if (keyA > keyB) return 1;
            return 0;
          }
        );
    },
    nlp_active() {
      const conf = this.$store.getters["service/get"]("NLPService", "skillUpdate");
      return this.$store.getters["settings/getValue"]("annotator.nlp.activated") === "true" && conf && "sentiment_classification" in conf;
    },
    nlp_result() {
      const res = this.$store.getters["service/get"]("NLPService", "skillResults");
      return res && this.commentId in res ? res[this.commentId] : null;
    },
    openedTextarea() {
      return !this.collapseComment && (this.edit || this.editedByMyself)
    },
    studySession() {
      return this.$store.getters["table/study_session/get"](this.studySessionId);
    },
    study() {
      if (this.studySession) {
        return this.$store.getters["table/study/get"](this.studySession.studyId);
      } else {
        return null;
      }
    },
    anonymize() {
      console.log(this.study);
      if (this.study) {
        return this.study.anonymize;
      } else {
        return false;
      }
    }
  },
  watch: {
    nlp_result(newV) {
      if (this.nlp_active) {
        this.awaitingNlpResult = newV === null;
      }
    },
    nlp_active() {
      if (this.nlp_active && this.nlp_result === null) {
        this.requestNlpFeedback();
      }
    },
    openedTextarea(newVal) {
      if (newVal) {
        this.$nextTick(() => this.$refs.textarea.focus());
      }
    },
    editedByMyself(newVal) {
      if (newVal && !this.listeningToFocus) {
        this.listenOnActive({action: this.saveOnDeactivated, id: this.commentId, level: this.level});
        this.listeningToFocus = true;
      } else if (this.listeningToFocus) {
        this.unlistenOnActive({id: this.commentId, level: this.level});
        this.listeningToFocus = false;
      }
    }
  },
  mounted() {
    if (this.nlp_active && this.nlp_result === null && this.comment.text !== null) {
      this.requestNlpFeedback();
    }
    if (this.level <= 1 || this.comment.draft) {
      this.collapseComment = false;
    }

    if (this.editedByMyself) {
      this.listenOnActive({action: this.saveOnDeactivated, id: this.commentId, level: this.level});
      this.listeningToFocus = true;
    }
  },
  unmounted() {
    if (this.editedByMyself) {
      if (this.level === 0) {
        this.saveCard();
      } else {
        this.save();
      }

      if (this.listeningToFocus) {
        this.unlistenOnActive({id: this.commentId, level: this.level});
      }
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
    saveOnDeactivated(active) {
      if (!active) {
        if (this.level === 0) {
          this.saveCard();
        } else {
          this.save();
        }
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
      this.editMode = null;
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
    toEditMode(status) {
      this.editMode = status;
    },
    reply() {
      this.$socket.emit('commentUpdate', {
        "documentId": this.documentId,
        "parentCommentId": this.commentId,
        "studySessionId": this.studySessionId,
        "studyStepId": this.studyStepId,
        "anonymous": this.anonymize,
      });
    },
    saveCard() {
      this.$emit("saveCard");
    },
    requestNlpFeedback() {
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
    },
    onPaste(event) {
      const pastedText = (event.clipboardData || window.clipboardData).getData('text');
      if (this.acceptStats && pastedText) {
        this.$socket.emit("stats", {
          action: "textPasted",
          data: {
            documentId: this.documentId,
            studySessionId: this.studySessionId,
            studyStepId: this.studyStepId,
            pastedText: pastedText
          }
        })
      }
    },
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

.blockquoteMain {
  margin-left: 0
}

</style>