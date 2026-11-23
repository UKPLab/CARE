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
          @click="startReply"
        />
      </div>
      <CardActions
        ref="actions"
        placement="bottom"
      >
      <VoteButtons :comment="comment"/>
      <SidebarButton
        v-if="comment.userId === userId && !readOnly"
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
  <CommentBody
    ref="body"
    :comment-id="commentId"
    :collapsed="collapseComment"
    :editing="edit || editedByMyself"
    :edit="edit"
    :level="level"
    :text-error="textError"
    @update:text-error="textError = $event"
    @submit="saveOnDeactivated(false)"
    @escape="cancelOnEscape"
  >
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
    <AnnotationReplies
      v-if="level >= 1"
      ref="replies"
      :comment-id="commentId"
      :show-replies="!collapseComment"
      :max-comments="maxComments"
      :level="level + 1"
      @update:show-replies="collapseComment = !$event"
      @update:max-comments="maxComments = $event"
    >
      <template #default="{reply}">
        <CommentCard
          :comment-id="reply.id"
          :level="level + 1"
        />
      </template>
    </AnnotationReplies>
  </CommentBody>
</template>

<script>
import LoadIcon from "@/basic/Icon.vue"
import Collaboration from "@/components/annotator/sidebar/card/Collaboration.vue"
import SidebarButton from "./Button.vue"
import VoteButtons from "@/components/annotator/sidebar/card/VoteButtons.vue";
import { focusNextAnnotationCard, formatLocalizedDate, formatLocalizedDateTime, resolveApiMessage } from "@/assets/utils";
import BasicButton from "@/basic/Button.vue";
import CardActions from "./CardActions.vue";
import CommentBody from "./CommentBody.vue";
import AnnotationReplies from "./AnnotationReplies.vue";

/**
 * Comment card in the sidebar
 *
 * The main comment of an annotation card (level 0) or a reply in its thread (level 1 and deeper).
 * Edits are saved when the card loses focus, on Ctrl+Enter, or on Save. An empty reply is not kept.
 *
 * @author: Nils Dycke, Dennis Zyska
 */
export default {
  name: "CommentCard",
  components: {VoteButtons, SidebarButton, LoadIcon, Collaboration, BasicButton, CardActions, CommentBody, AnnotationReplies},
  inject: {
    currentStudyStep: {default: null},
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
      required: false,
      default: 1,
    }
  },
  emits: ["saveCard", "cancelCard"],
  data() {
    return {
      editMode: false,
      collapseComment: true,
      listeningToFocus: false,
      pendingEdit: false,
      maxComments: 1,
      commentTextBeforeEdit: null,
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
    // Annotation comments may be empty. Replies and document notes need text.
    requiresText() {
      const comment = this.comment;
      if (!comment) return false;
      if (this.level >= 1 || comment.parentCommentId) return true;
      return !comment.annotationId;
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
    collapseComment(collapsed) {
      if (!collapsed || !this.pendingEdit || !this.comment) return;
      if (!(this.requiresText && !this.hasCommentText())) return;
      this.pendingEdit = false;
      if (this.comment.draft) this.remove();
      else this.restoreComment();
    },
    openedTextarea(newVal) {
      if (newVal) {
        this.commentTextBeforeEdit = this.comment?.text || "";
        // Remember what opened the editor (e.g. the Reply button) to return focus there
        const opener = document.activeElement;
        this.returnFocusEl = opener && opener !== document.body ? opener : null;
        this.$refs.body?.focusText();
      } else {
        // Runs before the editor closes, so we can tell if the keyboard was in this comment
        const body = this.$refs.body?.$el;
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
    if (this.level <= 1 || this.comment.draft) {
      this.collapseComment = false;
    }

    if (this.editedByMyself) {
      this.pendingEdit = true;
      this.commentTextBeforeEdit = this.comment?.text || "";
      this.listenOnActive({action: this.saveOnDeactivated, id: this.commentId, level: this.level});
      this.listeningToFocus = true;
    }
    this.maxComments = this.defaultNumComments;
  },
  beforeUnmount() {
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
        const previousText = this.commentTextBeforeEdit === null ? this.comment.text : this.commentTextBeforeEdit;
        const updatedText = this.comment.text;
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
          } else {
            this.logCommentUpdate(previousText, updatedText);
            this.commentTextBeforeEdit = updatedText;
          }
        });
        if (this.$refs.collab) {
          this.$refs.collab.removeCollab();
        }
        this.$refs.body?.analyzeSentiment();
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
      this.commentTextBeforeEdit = null;
      if (this.comment.draft) {
        this.remove();
      } else {
        this.restoreComment();
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
      const from = document.activeElement;
      if (from && from.closest && from.closest('li[role="article"]')) {
        focusNextAnnotationCard(from);
      }
    },
    toEditMode(status) {
      this.editMode = status;
    },
    startReply() {
      this.reply();
      this.collapseComment = false;
      this.$nextTick(() => this.$refs.replies?.expandForNewReply());
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
    /**
     * Logs saved comment text changes.
     *
     * @param {string} previousText - Text before editing.
     * @param {string} updatedText - Saved text.
     * @returns {void}
     */
    logCommentUpdate(previousText, updatedText) {
      if (!this.acceptStats || previousText === updatedText) return;
      this.$socket.emit("stats", {
        action: "commentUpdated",
        data: {
          ...(this.currentStudyStep?.id ? {currentStudyStepId: this.currentStudyStep.id} : {}),
          documentId: this.documentId,
          studySessionId: this.studySessionId,
          studyStepId: this.studyStepId,
          from: "comment",
          commentId: this.commentId,
          previousText: previousText,
          updatedText: updatedText
        }
      })
    },
  }
}
</script>

<style scoped>
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
