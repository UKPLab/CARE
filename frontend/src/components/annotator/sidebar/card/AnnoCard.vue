<template>
  <SideCard
      :loading="loading()"
      :shake="shake"
      :collapsed="collapsed"
  >
    <template #header>
      <div
        class="anno-card-head"
        :class="{ 'header-hoverable': collapsed && !editedByMyself }"
        :style="{ cursor: collapsed ? 'pointer' : 'default' }"
        @click="handleHeaderClick"
      >
        <!-- Mouse-only shortcut to open the card; the chevron below is the single keyboard and
             screen-reader control, so buttons are never nested inside each other -->
        <div class="anno-card-who">
          <div
            v-if="!editedByMyself"
            :title="collapsed ? $t('annotator.card.markedCheckedClickToUncheck') : $t('annotator.card.clickToMarkChecked')"
            class="card-focusable care-focus-ring anno-card-toggle"
            role="button"
            tabindex="0"
            :aria-expanded="!collapsed"
            @click.stop="handleCheckIconClick"
            @keydown.enter.exact.prevent="handleCheckIconClick"
            @keydown.space.exact.prevent="handleCheckIconClick"
          >
            <LoadIcon
              :icon-name="collapsed ? 'chevron-right' : 'chevron-down'"
              :size="14"
              class="check-icon"
            />
          </div>
          <span class="anno-card-avatar" aria-hidden="true">{{ authorInitial }}</span>
          <span class="anno-card-name">{{ comment.creator_name }}</span>
          <Collaboration
            ref="collab"
            :target-id="commentId"
            :document-id="documentId"
            target-type="comment"
            @collab-status="toEditMode"
          />
        </div>
        <div class="anno-card-date">
          <span
            v-if="annotation"
            :title="fullDate(annotation.updatedAt)"
          >
            {{ cardDate(annotation.updatedAt) }}
          </span>
          <span
            v-else
            :title="fullDate(comment.updatedAt)"
          >
            {{ cardDate(comment.updatedAt) }}
          </span>
        </div>
      </div>
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
        <div class="ms-auto">
          <div
              v-if="editedByMyself"
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
          <div
              v-else
              class="anno-card-bar"
          >
          <BasicButton
              v-if="numberReplies > 0"
              ref="repliesToggle"
              class="btn btn-sm btn-link"
              :icon="showReplies ? 'eye-slash' : 'eye'"
              :aria-expanded="showReplies ? 'true' : 'false'"
              :text="showReplies ? $t('common.hideReplies', { count: numberReplies }) : $t('common.showReplies', { count: numberReplies })"
              @click="showReplies = !showReplies; maxComments = defaultNumComments"
          />
          <div
              v-if="settingResponse && !readOnly"
              @click.stop
          >
            <BasicButton
                class="btn btn-sm btn-link"
                icon="reply"
                :text="$t('common.reply')"
                @click="$refs.main_comment.reply(); $refs.replies.expandForNewReply()"
            />
          </div>
          <CardActions
              ref="actions"
          >
              <AnnotationSummarize
                  :annotation-id="annotationId"
                  :comment-id="commentId"
                  @summarized="showReplies = true"
              />
              <VoteButtons :comment="comment"/>
              <SidebarButton
                  v-if="comment.userId === userId && !readOnly"
                  ref="editButton"
                  :loading="false"
                  :props="$props"
                  icon="pencil-square"
                  :title="comment.text != null && comment.text.length > 0 ? $t('annotator.card.editComment') : $t('annotator.card.addComment')"
                  @click="edit"
              />
              <SidebarButton
                v-if="comment.userId === userId && !readOnly && annotationId"
                :loading="false"
                :props="$props"
                icon="tag"
                :title="$t('annotator.card.changeTag')"
                @click="$refs.annotationTag.toggleEditTag()"
            />
              <SidebarButton
                  v-if="comment.userId === userId && !readOnly"
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
      </template>

      <template #thread>
        <AnnotationReplies
            ref="replies"
            :comment-id="commentId"
            :show-replies="showReplies"
            :max-comments="maxComments"
            @update:show-replies="showReplies = $event"
            @update:max-comments="maxComments = $event"
        />
      </template>
    </SideCard>
  </template>

<script>
import SideCard from "./Card.vue";
import Comment from "./Comment.vue";
import Collaboration from "@/components/annotator/sidebar/card/Collaboration.vue"
import SidebarButton from "./Button.vue"
import VoteButtons from "@/components/annotator/sidebar/card/VoteButtons.vue";
import LoadIcon from "@/basic/Icon.vue";
import { focusNextAnnotationCard, formatLocalizedDate, formatLocalizedDateTime, resolveApiMessage } from "@/assets/utils";
import BasicButton from "@/basic/Button.vue";
import AnnotationTag from "./AnnotationTag.vue";
import AnnotationSummarize from "./AnnotationSummarize.vue";
import AnnotationReplies from "./AnnotationReplies.vue";
import CardActions from "./CardActions.vue";

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
  components: {VoteButtons, Collaboration, SideCard, Comment, SidebarButton, LoadIcon, BasicButton, AnnotationTag, AnnotationSummarize, AnnotationReplies, CardActions},
  inject: {
    documentId: {
      type: Number,
      required: true,
    },
    acceptStats: {
      type: Boolean,
      required: false,
      default: () => false
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
    }
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
    commentState() {
      return this.$store.getters['table/comment_state/getFiltered'](
        a => a.commentId === this.commentId && a.userId === this.userId
      )[0] || null;
    },
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    settingResponse() {
      return this.$store.getters["settings/getValue"]('annotator.collab.response') === "true";
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
    authorInitial() {
      const name = (this.comment?.creator_name || "").trim();
      return name ? name.charAt(0).toUpperCase() : "?";
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
    commentState: {
    immediate: true,
    handler(newVal) {
      if (newVal) {
        this.collapsed = newVal.state === 1 ? true : false;
      }
    }
  },
    collapsed(newValue) {
      if(!this.commentState){
        this.$socket.emit("appDataUpdate", {
          table: "comment_state",
          data: {
            userId: this.userId,
            documentId: this.documentId,
            studySessionId: this.studySessionId,
            studyStepId: this.studyStepId,
            commentId: this.commentId,
            state: newValue? 1 : 0,
          }
        });
      } else {
        this.$socket.emit("appDataUpdate", {
          table: "comment_state",
          data: {
            id: this.commentState.id,
            state: newValue? 1 : 0,
          }
        });
      }    
      if(this.acceptStats) {
        this.$socket.emit("stats", {
          action: "commentToggleCollapse",
          data: {
            commentId: this.commentId,
            state: newValue,
          }
        });
      }
    }
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
    formatLocalizedDate,
    cardDate(value) {
      return formatLocalizedDate(value, { day: "numeric", month: "short", year: "numeric" });
    },
    fullDate(value) {
      return formatLocalizedDateTime(value);
    },
    shakeIt() {
      this.shake = true;
      setTimeout(() => this.shake = false, 1500);
    },
    loading() {
      if (this.annotationId && !this.annotation) {
        return true;
      }
      return false;
    },
    handleHeaderClick() {
      if (this.collapsed && !this.editedByMyself) {
        this.collapsed = false;
      }
    },
    handleCheckIconClick() {
      this.collapsed = !this.collapsed;
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
    cancel() {
      if (this.annotationId) {

        if (this.annotation.draft) {
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
      } else {
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
      }
      this.$refs.collab.removeCollab();
      this.edit_mode = null;
    },
    remove() {
      if (this.annotationId) {
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
      } else {
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
      }
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

<style scoped>
.card-focusable:focus-visible {
  border-radius: 4px;
}

.check-icon:hover {
  color: var(--care-primary);
}

.header-hoverable {
  transition: background-color 0.2s ease;
}

.header-hoverable:hover {
  background-color: var(--bs-secondary-bg);
  border-radius: 4px;
}

.anno-card-head {
  display: flex;
  align-items: center;
  gap: .5rem;
}

.anno-card-who {
  display: flex;
  align-items: center;
  gap: .4rem;
  min-width: 0;
  flex: 1;
}

.anno-card-toggle {
  display: inline-flex;
  flex: none;
}

.anno-card-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 50%;
  font-size: .75rem;
  font-weight: 600;
  background: var(--bs-secondary-bg);
  color: var(--bs-body-color);
}

.anno-card-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  color: var(--bs-body-color);
}

.anno-card-date {
  flex: none;
  font-size: .75rem;
  color: var(--bs-secondary-color);
}

.anno-card-bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: .25rem;
}
</style>