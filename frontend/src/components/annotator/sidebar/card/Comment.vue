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
            @click="collapseComment = !collapseComment; maxComments = defaultNumComments"
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
          {{ formatLocalizedDate(comment.updatedAt) }}
        </div>
      </div>
    </div>
  </div>
  <CommentBody
    ref="body"
    :comment-id="commentId"
    :collapsed="collapseComment"
    :editing="edit || editedByMyself"
    :edit="edit"
    @submit="saveOnDeactivated(false)"
    @escape="cancelOnEscape"
  >
    <CommentActions
      v-if="level >= 1 && (!editedByMyself || !readOnly)"
      ref="actions"
      :comment="comment"
      :editing="editedByMyself"
      :save-title="$t('components.comment.saveCommand')"
      :can-delete-others="myBotRequest"
      :stats-props="$props"
      @save="save"
      @cancel="cancel"
      @edit="editComment"
      @delete="moveFocusToNextCard(); remove()"
      @replied="$refs.replies.expandForNewReply()"
    />
    <AnnotationReplies
      v-if="level >= 1"
      ref="replies"
      v-model:max-comments="maxComments"
      :comment-id="commentId"
      :level="level + 1"
      :show-replies="!collapseComment"
      @update:show-replies="collapseComment = !$event"
    >
      <template #default="{reply}">
        <hr class="hr">
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
import CommentBody from "./CommentBody.vue";
import CommentActions from "./CommentActions.vue";
import AnnotationReplies from "./AnnotationReplies.vue";
import { focusNextAnnotationCard, formatLocalizedDate, resolveApiMessage } from "@/assets/utils";

/**
 * Comment card in the sidebar
 *
 * The main comment of an annotation card (level 0) or a reply in its thread (level 1 and deeper), with its
 * own header, actions and replies. Edits are saved when the card loses focus, on Ctrl+Enter, or on Save.
 *
 * @author: Nils Dycke, Dennis Zyska
 */
export default {
  name: "CommentCard",
  components: {LoadIcon, Collaboration, CommentBody, CommentActions, AnnotationReplies},
  inject: {
    currentStudyStep: {default: null},
    documentId: {default: null},
    studySessionId: {default: null},
    studyStepId: {default: null},
    readOnly: {default: false},
    listenOnActive: {from: "listenOnActive"},
    unlistenOnActive: {from: "unlistenOnActive"},
    acceptStats: {default: () => false},
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
      editMode: false,
      collapseComment: true,
      listeningToFocus: false,
      maxComments: 1,
      commentTextBeforeEdit: null,
      returnFocusEl: null,
    }
  },
  computed: {
    defaultNumComments() {
      return parseInt(this.$store.getters["settings/getValue"]("annotator.comments.defaultNumsShown.levelOneUp"));
    },
    comment() {
      return this.$store.getters["table/comment/get"](this.commentId);
    },
    myBotRequest() {
      return this.comment.creator_name === "Bot"
        && this.$store.getters["table/comment/get"](this.comment.parentCommentId).userId === this.$store.getters["auth/getUserId"];
    },
    editedByMyself() {
      return (this.comment) ? this.comment.draft || this.editMode || this.edit : false;
    },
    openedTextarea() {
      return !this.collapseComment && (this.edit || this.editedByMyself)
    },
  },
  watch: {
    openedTextarea(newVal) {
      if (newVal) {
        this.commentTextBeforeEdit = this.comment?.text || "";
        const opener = document.activeElement;
        this.returnFocusEl = opener && opener !== document.body ? opener : null;
        this.$refs.body.focusText();
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
            else this.$refs.actions?.focusEdit();
          });
        }
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
    if (this.level <= 1 || this.comment.draft) {
      this.collapseComment = false;
    }

    if (this.editedByMyself) {
      this.commentTextBeforeEdit = this.comment?.text || "";
      this.listenOnActive({action: this.saveOnDeactivated, id: this.commentId, level: this.level});
      this.listeningToFocus = true;
    }
    this.maxComments = this.defaultNumComments;
  },
  beforeUnmount() {
    if (this.editedByMyself) {
      this.saveOnDeactivated(false);

      if (this.listeningToFocus) {
        this.unlistenOnActive({id: this.commentId, level: this.level});
      }
    }
  },
  methods: {
    formatLocalizedDate,
    save() {
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
    /** Saves the edit when the card loses focus; the card's main comment (level 0) is saved by the card. */
    saveOnDeactivated(active) {
      if (!active) {
        if (this.level === 0) {
          this.$emit("saveCard");
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
      this.commentTextBeforeEdit = null;
      this.editMode = null;
    },
    /**
     * Cancels the edit from the keyboard, mirroring the mouse Cancel button.
     * The card's main comment (level 0) is cancelled by the parent card,
     * the same route saveCard uses; replies cancel themselves.
     * Drafts are ignored so a single key press cannot delete a new comment.
     * @returns {void}
     */
    cancelOnEscape() {
      if (this.comment.draft) {
        return;
      }
      if (this.level === 0) {
        this.$emit("cancelCard");
      } else {
        this.cancel();
      }
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
      const body = this.$refs.body?.$el;
      if (body && body.contains && body.contains(document.activeElement)) {
        focusNextAnnotationCard(body);
      }
    },
    toEditMode(status) {
      this.editMode = status;
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
          ...(this.currentStudyStep?.id ? {currentStudyStepId: this.currentStudyStep?.id} : {}),
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
