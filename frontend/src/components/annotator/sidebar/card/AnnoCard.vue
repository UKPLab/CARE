<template>
  <SideCard
      :loading="loading()"
      :shake="shake"
      :collapsed="collapsed"
  >
    <template #header>
      <AnnoCardHeader
          v-model:collapsed="collapsed"
          :comment-id="commentId"
          :creator-name="comment.creator_name"
          :updated-at="(annotation || comment).updatedAt"
          :editing="editedByMyself"
      >
        <Collaboration
            ref="collab"
            :target-id="commentId"
            :document-id="documentId"
            target-type="comment"
            @collab-status="toEditMode"
        />
      </AnnoCardHeader>
    </template>
      <template #body>
        <AnnotationTag
            ref="annotationTag"
            :annotation-id="annotationId"
            :comment-id="commentId"
            :editing-tag="editingTag"
            :selected-tag-id="selectedTagId"
            @update:editing-tag="editingTag = $event"
            @update:selected-tag-id="selectedTagId = $event"
        />
        <Comment
            ref="main_comment"
            :comment-id="commentId"
            :edit="editedByMyself"
            :level="0"
            @save-card="save()"
            @cancel-card="cancel"
        />
      </template>

      <template #footer>
        <CommentActions
            ref="actions"
            :comment="comment"
            :editing="editedByMyself"
            :save-title="$t('components.comment.saveCommand')"
            :edit-title="comment.text != null && comment.text.length > 0 ? $t('annotator.card.editComment') : $t('annotator.card.addComment')"
            :stats-props="$props"
            @save="save"
            @cancel="cancel"
            @edit="edit"
            @delete="moveFocusToNextCard(); remove()"
            @replied="$refs.replies.expandForNewReply()"
        >
          <template #start>
            <BasicButton
                v-if="numberReplies > 0"
                ref="repliesToggle"
                class="btn btn-sm btn-link"
                :icon="showReplies ? 'eye-slash' : 'eye'"
                :aria-expanded="showReplies ? 'true' : 'false'"
                :text="showReplies ? $t('common.hideReplies', { count: numberReplies }) : $t('common.showReplies', { count: numberReplies })"
                @click="showReplies = !showReplies; maxComments = defaultNumComments"
            />
          </template>
          <template #before-vote>
            <AnnotationSummarize
                :annotation-id="annotationId"
                :comment-id="commentId"
                @summarized="showReplies = true"
            />
          </template>
          <template #before-delete>
            <SidebarButton
                v-if="comment.userId === userId && !readOnly && annotationId"
                :loading="false"
                :props="$props"
                icon="tag"
                :title="$t('annotator.card.changeTag')"
                @click="$refs.annotationTag.toggleEditTag()"
            />
          </template>
        </CommentActions>
      </template>

      <template #thread>
        <AnnotationReplies
            ref="replies"
            :comment-id="commentId"
            :show-replies="showReplies"
            :max-comments="maxComments"
            @update:show-replies="showReplies = $event"
            @update:max-comments="maxComments = $event"
        >
          <template #default="{reply}">
            <Comment
                :comment-id="reply.id"
                :level="1"
            />
          </template>
        </AnnotationReplies>
      </template>
    </SideCard>
  </template>

<script>
import SideCard from "./Card.vue";
import Comment from "./Comment.vue";
import Collaboration from "@/components/annotator/sidebar/card/Collaboration.vue"
import SidebarButton from "./Button.vue"
import { focusNextAnnotationCard, resolveApiMessage } from "@/assets/utils";
import BasicButton from "@/basic/Button.vue";
import AnnoCardHeader from "./AnnoCardHeader.vue";
import AnnotationTag from "./AnnotationTag.vue";
import AnnotationSummarize from "./AnnotationSummarize.vue";
import AnnotationReplies from "./AnnotationReplies.vue";
import CommentActions from "./CommentActions.vue";

/** Annotation elements
 *
 * This component holds the current data of each annotation with a comment (and its children).
 *
 * @author Nils Dycke, Dennis Zyska
 *
 */
export default {
  name: "AnnoCard",
  subscribeTable: ['tag', 'tag_set', 'comment_state'],
  components: {
    Collaboration, SideCard, Comment, SidebarButton, BasicButton, AnnoCardHeader, AnnotationTag,
    AnnotationSummarize, AnnotationReplies, CommentActions,
  },
  inject: {
    documentId: {default: null},
    readOnly: {default: false},
  },
  props: {
    'commentId': {
      type: Number,
      required: true,
    },
  },
  emits: ['focus', 'new-anno-card'],
  data: function () {
    return {
      shake: false,
      showReplies: false,
      edit_mode: false,
      editingTag: false,
      selectedTagId: null,
      collapsed: false,
      maxComments: 3,
    }
  },
  computed: {
    defaultNumComments() {
      return parseInt(this.$store.getters["settings/getValue"]("annotator.comments.defaultNumsShown.levelZero"));
    },
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    annotation() {
      return this.$store.getters['table/annotation/get'](this.annotationId);
    },
    annotationId() {
      const annotationId = this.comment.annotationId;
      if (annotationId)
        return annotationId;
      return null;
    },
    editedByMyself() {
      return this.comment.draft || this.edit_mode;
    },
    numberReplies() {
      return this.$store.getters["table/comment/countByKey"]("parentCommentId", this.commentId, true);
    },
    comment() {
      return this.$store.getters['table/comment/get'](this.commentId);
    },
  },
  watch: {
    editedByMyself(newVal) {
      if (newVal) return;
      // Runs before the editor closes: if the keyboard was in this card, land on the Edit button again
      if (this.$el && this.$el.contains && this.$el.contains(document.activeElement)) {
        this.$nextTick(() => {
          if (this.$refs.actions) this.$refs.actions.focusTrigger();
        });
      }
    },
    showReplies(newVal) {
      if (newVal) return;
      // Runs before the thread is removed: if the keyboard was in it, move focus to the toggle
      const thread = this.$refs.replies && this.$refs.replies.$el;
      const hadFocus = thread && thread.contains && thread.contains(document.activeElement);
      if (hadFocus) {
        this.$nextTick(() => {
          const toggle = this.$refs.repliesToggle && this.$refs.repliesToggle.$el;
          if (toggle) toggle.focus();
        });
      }
    },
  },
  mounted() {
    if (this.comment.draft) {
      //focus (delay necessary, because the sidepane first needs to update the scrollable area before focusing)
      this.$emit('new-anno-card');
      setTimeout(() => this.$emit("focus", this.commentId), 100);
      this.shakeIt();
    }
  },
  methods: {
    shakeIt() {
      this.shake = true;
      setTimeout(() => this.shake = false, 1500);
    },
    // The annotation of the card is not in the store yet
    loading() {
      return !!this.annotationId && !this.annotation;
    },
    save() {
      if (this.$refs.main_comment && this.$refs.main_comment.acceptText() === false) {
        return;
      }
      if (this.annotationId && this.annotation) {
        this.$socket.emit('annotationUpdate', {
          "annotationId": this.annotation.id,
          "tagId": this.annotation.tagId,
        }, (res) => {
          if (!res.success) {
            this.eventBus.emit("toast", {
              title: this.$t('errors.annotator.annotationUpdateFailed'),
              message: resolveApiMessage(res),
              variant: "danger",
            });
            return //to ensure we dont save the comment if the annotation update fails
          }
        });
      }
      this.$refs.main_comment?.save();
      this.$refs.collab?.removeCollab();
    },
    /** Discards the edit: a draft is deleted, otherwise the stored annotation or comment is fetched again. */
    cancel() {
      if (!this.annotationId) {
        // The card's own comment knows how to discard its edit
        this.$refs.main_comment?.cancel();
      } else if (this.annotation.draft) {
        this.remove();
      } else {
        this.$socket.emit('annotationGet', {
          "annotationId": this.annotation.id,
          "documentId": this.documentId
        }, (result) => {
          if (!result.success) {
            this.eventBus.emit("toast", {
              title: this.$t('errors.annotator.annotationNotRetrieved'),
              message: resolveApiMessage(result),
              variant: "danger",
            });
          }
        });
      }
      this.$refs.collab.removeCollab();
      this.edit_mode = null;
    },
    remove() {
      if (!this.annotationId) {
        this.$refs.main_comment?.remove();
        return;
      }
      this.$socket.emit('annotationUpdate', {
        "annotationId": this.annotation.id,
        "tagId": this.annotation.tagId,
        "deleted": true
      }, (res) => {
        if (!res.success) {
          this.eventBus.emit("toast", {
            title: this.$t('errors.annotator.annotationUpdateFailed'),
            message: resolveApiMessage(res),
            variant: "danger",
          });
        }
      });
    },
    edit() {
      this.$refs.collab.startCollab();
    },
    /**
     * Before the card is deleted, moves keyboard focus to the next annotation card.
     * @returns {void}
     */
    moveFocusToNextCard() {
      if (this.$el && this.$el.contains && this.$el.contains(document.activeElement)) {
        focusNextAnnotationCard(this.$el);
      }
    },
    toEditMode(status) {
      this.edit_mode = status;
    },
    putFocus() {
      this.shakeIt();
    },
  }
}
</script>
