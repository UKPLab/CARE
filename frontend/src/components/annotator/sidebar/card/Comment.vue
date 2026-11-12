<template>
  <div
    v-if="level >= 1"
    class="anno-reply-head"
  >
    <div class="anno-reply-who">
      <div
        class="card-focusable care-focus-ring anno-card-toggle"
        role="button"
        tabindex="0"
        :aria-expanded="!collapseComment"
        @click="collapseComment = !collapseComment; maxComments = defaultNumComments"
        @keydown.enter.exact.prevent="collapseComment = !collapseComment; maxComments = defaultNumComments"
        @keydown.space.exact.prevent="collapseComment = !collapseComment; maxComments = defaultNumComments"
      >
        <LoadIcon
          :icon-name="(collapseComment) ? 'chevron-right' : 'chevron-down'"
          :size="14"
          class="check-icon"
        />
      </div>
      <span class="anno-reply-avatar" aria-hidden="true">{{ authorInitial }}</span>
      <span class="anno-reply-name">{{ comment.creator_name }}</span>
      <Collaboration
        ref="collab"
        :document-id="documentId"
        :target-id="commentId"
        target-type="comment"
        @collab-status="toEditMode"
      />
    </div>
    <span
      class="anno-reply-date"
      :title="fullDate(comment.updatedAt)"
    >{{ cardDate(comment.updatedAt) }}</span>
    <div
      v-if="!editedByMyself"
      class="d-flex align-items-center gap-1"
    >
      <div
        v-if="settingResponse && !readOnly"
        @click.stop
      >
        <BasicButton
          class="btn btn-sm btn-link"
          icon="reply"
          :text="$t('common.reply')"
          @click="reply(); maxComments = numChildComments + 1"
        />
      </div>
      <CardActions
        ref="actions"
        placement="bottom"
      >
      <VoteButtons :comment="comment"/>
      <SidebarButton
        v-if="comment.userId === userId && !readOnly"
        ref="editButton"
        :loading="false"
        :props="$props"
        icon="pencil-square"
        :title="$t('annotator.card.editReply')"
        @click="editComment"
      />
      <SidebarButton
        v-if="(comment.userId === userId || myBotRequest) && !readOnly"
        class="anno-action-danger"
        :loading="false"
        :props="$props"
        icon="trash3"
        :title="$t('common.delete')"
        @click="moveFocusToNextCard(); remove()"
      />
      </CardActions>
    </div>
  </div>
  <div
    v-if="!collapseComment"
    ref="commentBody"
    class="comment card-text"
  >
    <div v-if="edit || editedByMyself">
      <textarea
        ref="textarea"
        v-model="comment.text"
        class="form-control anno-note"
        :placeholder="$t('components.comment.enterText')"
        @keydown.ctrl.enter.exact.prevent="saveOnDeactivated(false)"
        @keydown.meta.enter.exact.prevent="saveOnDeactivated(false)"
        @keydown.esc.exact.prevent="cancelOnEscape"
        @paste="onPaste"
        @input="textError = false"
      />
      <div
        v-if="textError"
        class="feedback-invalid invalid"
      >
        {{ $t('errors.element.fieldRequired') }}
      </div>
    </div>
    <div
      v-else-if="comment.text != null && comment.text.length > 0"
      :class="{ 'anno-comment-body': level === 0 }"
    >
      {{ comment.text }}
    </div>
    <div
      v-else
      class="anno-comment-empty"
    >
      <i>{{ $t('components.comment.noComment')}}</i>
    </div>
    <div
      v-if="isSentimentAnalysisActive"
      class="text-end fw-light"
      :title="$t('components.comment.sentimentAnalysis')"
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
      class="anno-tags"
      :disabled="!edit"
      :is-editor="comment.userId === userId"
    />
    <div
      v-if="level >= 1 && editedByMyself && !readOnly"
      class="d-flex justify-content-end align-items-center gap-2"
      @click.stop
    >
      <BasicButton
        class="btn btn-link btn-sm"
        :text="$t('common.cancel')"
        :title="$t('common.cancel')"
        aria-keyshortcuts="Escape"
        @click="cancel"
      />
      <BasicButton
        class="btn btn-primary btn-sm"
        :text="$t('common.save')"
        :title="$t('components.comment.saveCommand')"
        aria-keyshortcuts="Meta+Enter Control+Enter"
        @click="save"
      />
    </div>
    <span v-if="level >= 1 && (displayedComments.length > 0 || showExtenderButton || numChildComments > defaultNumComments)">
      <span
        v-for="c in displayedComments"
        :key="c.id"
      >
        <hr class="hr">
        <CommentCard
          :comment-id="c.id"
          :level="level + 1"
        />
    </span>
    <div
      v-if="showExtenderButton || numChildComments > defaultNumComments"
      class="anno-reply-more"
    >
      <BasicButton
        v-if="showExtenderButton"
        ref="showMore"
        class="btn btn-sm btn-link"
        :text="$t('common.showMoreCount', { count: numChildComments - maxComments })"
        @click="maxComments+=5"
      />
      <BasicButton
        v-if="!showExtenderButton && numChildComments > defaultNumComments"
        class="btn btn-sm btn-link"
        :text="$t('common.showLess')"
        @click="showLess"
      />
    </div>
    
    </span>
  </div>
</template>

<script>
import TagSelector from "./TagSelector.vue";
import IconLoading from "@/basic/icon/IconLoading.vue";
import LoadIcon from "@/basic/Icon.vue"
import Collaboration from "@/components/annotator/sidebar/card/Collaboration.vue"
import SidebarButton from "./Button.vue"
import VoteButtons from "@/components/annotator/sidebar/card/VoteButtons.vue";
import { focusNextAnnotationCard, formatLocalizedDate, formatLocalizedDateTime, resolveApiMessage } from "@/assets/utils";
import BasicButton from "@/basic/Button.vue";
import CardActions from "./CardActions.vue";

/**
 * Comment card in the sidebar
 *
 * SideCard, which contains only a comment, but no annotation.
 *
 * @author: Nils Dycke, Dennis Zyska
 */
export default {
  name: "CommentCard",
  components: {VoteButtons, TagSelector, SidebarButton, IconLoading, LoadIcon, Collaboration, BasicButton, CardActions},
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
    readOnly: {
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
  emits: ["saveCard", "cancelCard"],
  data() {
    return {
      awaitingNlpResult: false,
      editMode: false,
      collapseComment: true,
      listeningToFocus: false,
      pendingEdit: false,
      maxComments: 1,
      returnFocusEl: null,
      textError: false,
    }
  },
  computed: {
    defaultNumComments() {
      return parseInt(this.$store.getters["settings/getValue"]("annotator.comments.defaultNumsShown.levelOneUp"));
    },
    comment() {
      return this.$store.getters["table/comment/get"](this.commentId);
    },
    authorInitial() {
      const name = (this.comment?.creator_name || "").trim();
      return name ? name.charAt(0).toUpperCase() : "?";
    },
    skills() {
      return this.$store.getters["service/getSkills"]("NLPService");
    },
    isSentimentAnalysisActive(){
      return this.$store.getters["settings/getValue"]("annotator.nlp.sentiment_analysis.activated") === "true"
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
    numChildComments(){
      if (this.childComments){
        return this.childComments.length;
      }
      return 0;
    },
    displayedComments() {
      return this.childComments.slice(0, this.maxComments);
    },
    showExtenderButton() {
      return this.numChildComments > this.maxComments;
    },
    // Annotation comments may be empty. Replies and document notes need text.
    requiresText() {
      const comment = this.comment;
      if (!comment) return false;
      if (this.level >= 1 || comment.parentCommentId) return true;
      return !comment.annotationId;
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
    collapseComment(collapsed) {
      if (!collapsed || !this.pendingEdit || !this.comment) return;
      if (!(this.requiresText && !this.hasCommentText())) return;
      this.pendingEdit = false;
      if (this.comment.draft) this.remove();
      else this.restoreComment();
    },
    openedTextarea(newVal) {
      if (newVal) {
        // Remember what opened the editor (e.g. the Reply button) to return focus there
        const opener = document.activeElement;
        this.returnFocusEl = opener && opener !== document.body ? opener : null;
        this.$nextTick(() => this.$refs.textarea.focus());
      } else {
        // Runs before the editor closes, so we can tell if the keyboard was in this comment
        const body = this.$refs.commentBody;
        const hadFocus = body && body.contains(document.activeElement);
        const opener = this.returnFocusEl;
        this.returnFocusEl = null;
        if (hadFocus) {
          this.$nextTick(() => {
            // Back to the button that opened the editor; Edit is replaced while editing, so use the new one
            if (opener && opener.isConnected) opener.focus();
            else if (this.$refs.actions) this.$refs.actions.focusTrigger();
          });
        }
      }
    },
    editedByMyself(newVal) {
      if (newVal) this.pendingEdit = true;
      if (!newVal) this.textError = false;
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
      this.pendingEdit = true;
      this.listenOnActive({action: this.saveOnDeactivated, id: this.commentId, level: this.level});
      this.listeningToFocus = true;
    }
    this.maxComments = this.defaultNumComments;
  },
  unmounted() {
    this.leaveEdit();
    if (this.listeningToFocus) {
      this.unlistenOnActive({id: this.commentId, level: this.level});
    }
  },
  methods: {
    formatLocalizedDate,
    cardDate(value) {
      return formatLocalizedDate(value, { day: "numeric", month: "short", year: "numeric" });
    },
    fullDate(value) {
      return formatLocalizedDateTime(value);
    },
    /**
     * Replies and document notes need text. Returns false and shows the field error when they do not.
     * @returns {boolean}
     */
    acceptText() {
      if (!this.requiresText || this.hasCommentText()) {
        this.textError = false;
        return true;
      }
      this.textError = true;
      return false;
    },
    hasCommentText() {
      const text = this.comment && this.comment.text;
      return typeof text === "string" && text.trim().length > 0;
    },
    /**
     * The editor is closing. An empty required draft is deleted.
     * A saved note with its text cleared is reloaded. Anything with text is saved.
     * @returns {void}
     */
    leaveEdit() {
      if (!this.pendingEdit || !this.comment) return;
      this.pendingEdit = false;
      if (this.requiresText && !this.hasCommentText()) {
        if (this.comment.draft) this.remove();
        else this.restoreComment();
        return;
      }
      this.save();
    },
    save() {
      if (!this.acceptText()) {
        return false;
      }
      this.pendingEdit = false;
      if (this.commentId && this.comment) {
        this.$socket.emit('commentUpdate', {
          "commentId": this.commentId,
          "tags": JSON.stringify(this.comment.tags.sort()),
          "text": this.comment.text,
        }, (res) => {
          if (!res.success) {
            this.eventBus.emit("toast", {
              title: this.$t('errors.annotator.commentNotUpdated'),
              message: resolveApiMessage(res),
              variant: "danger",
            });
          }
        });
        if (this.$refs.collab) {
          this.$refs.collab.removeCollab();
        }

        // send to model upon save (regardless of the server response on the update (!))
        if (this.comment.text && this.nlp_active) {
          this.requestNlpFeedback()
        }
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
      this.pendingEdit = false;
      if (this.comment.draft) {
        this.remove();
      } else {
        this.$socket.emit('commentGet', {
          "commentId": this.comment.id,
        }, (res) => {
          if (!res.success) {
              this.eventBus.emit("toast", {
                title: this.$t('errors.annotator.commentsNotRetrieved'),
                message: resolveApiMessage(res),
                variant: "danger",
              });
            }
        });
      }
      if (this.$refs.collab) {
        this.$refs.collab.removeCollab();
      }
      this.editMode = null;
    },
    /**
     * Cancels the edit from the keyboard, mirroring the mouse Cancel button.
     * The card's main comment (level 0) is cancelled by the parent card,
     * the same route saveCard uses; replies cancel themselves.
     * An empty draft is removed, the same as Cancel.
     * @returns {void}
     */
    cancelOnEscape() {
      this.pendingEdit = false;
      if (this.level === 0) {
        this.$emit("cancelCard");
      } else {
        this.cancel();
      }
    },
    restoreComment() {
      if (!this.comment?.id) return;
      this.$socket.emit('commentGet', {
        "commentId": this.comment.id,
      }, (res) => {
        if (!res.success) {
          this.eventBus.emit("toast", {
            title: this.$t('errors.annotator.commentsNotRetrieved'),
            message: resolveApiMessage(res),
            variant: "danger",
          });
        }
      });
    },
    remove() {
      this.$socket.emit('commentUpdate', {
        "commentId": this.comment.id,
        "deleted": true
      }, (res) => {
        if (!res.success) {
          this.eventBus.emit("toast", {
            title: this.$t('errors.annotator.commentNotUpdated'),
            message: resolveApiMessage(res),
            variant: "danger",
          });
        }
      });
    },
    editComment() {
      this.$refs.collab.startCollab();
    },
    /**
     * Before the comment is deleted, moves keyboard focus to the next annotation card.
     * @returns {void}
     */
    moveFocusToNextCard() {
      const body = this.$refs.commentBody;
      if (body && body.contains(document.activeElement)) {
        focusNextAnnotationCard(body);
      }
    },
    /**
     * Shows fewer replies; the Show less button disappears, so focus moves to Show more.
     * @returns {void}
     */
    showLess() {
      this.maxComments = this.defaultNumComments;
      this.$nextTick(() => {
        if (this.$refs.showMore) this.$refs.showMore.$el.focus();
      });
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
      }, (res) => {
        if (!res.success) {
          this.eventBus.emit("toast", {
            title: this.$t('errors.annotator.commentNotUpdated'),
            message: resolveApiMessage(res),
            variant: "danger",
          });
        }
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
  display: flex;
  flex-direction: column;
  gap: .5rem;
  margin: 0;
  color: var(--bs-body-color);
  font-style: normal;
}

.anno-note {
  border-radius: var(--care-radius-md);
}

.anno-comment-body {
  padding: .55rem .7rem;
  border: 1px solid var(--bs-border-color);
  border-radius: var(--care-radius-md);
  background: var(--bs-tertiary-bg);
}

.anno-comment-empty {
  color: var(--bs-secondary-color);
  font-size: .8125rem;
}

.anno-reply-more {
  display: flex;
  gap: .35rem;
}

.anno-tags {
  margin: 0;
}

.anno-reply-head {
  display: flex;
  align-items: center;
  gap: .5rem;
  margin-bottom: .5rem;
}

.anno-reply-who {
  display: flex;
  align-items: center;
  gap: .4rem;
  min-width: 0;
  flex: 1;
}

.anno-reply-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 50%;
  font-size: .7rem;
  font-weight: 600;
  background: var(--bs-secondary-bg);
  color: var(--bs-body-color);
}

.anno-reply-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  color: var(--bs-body-color);
}

.anno-reply-date {
  flex: none;
  font-size: .75rem;
  color: var(--bs-secondary-color);
}

</style>