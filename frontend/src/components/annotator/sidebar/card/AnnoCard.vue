<template>
  <SideCard
      :loading="loading()"
      :shake="shake"
      :collapsed="collapsed"
  >
    <template #header>
      <div 
        class="row" 
        :class="{ 'header-hoverable': collapsed && !editedByMyself }"
        :style="{ cursor: collapsed ? 'pointer' : 'default' }" 
        @click="handleHeaderClick"
      >
        <div class="col" style="display: flex; align-items: center;">
          <div 
            v-if="!editedByMyself"
            :title="collapsed ? $t('annotator.card.markedCheckedClickToUncheck') : $t('annotator.card.clickToMarkChecked')"
            style="display: inline-flex; margin-right: 8px;"
            @click.stop="handleCheckIconClick"
          >
            <LoadIcon
              :icon-name="collapsed ? 'chevron-right' : 'chevron-down'"
              :size="18"
              :style="{ cursor: 'pointer' }"
              class="check-icon"
            />
          </div>
          {{ comment.creator_name }}
          <Collaboration
            ref="collab"
            :target-id="commentId"
            :document-id="documentId"
            target-type="comment"
            @collab-status="toEditMode"
          />
        </div>
        <div class="col text-end">
          <span v-if="annotation">
            {{ formatLocalizedDate(annotation.updatedAt) }}
          </span>
          <span v-else>
            {{ formatLocalizedDate(comment.updatedAt) }}
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
        />
      </template>

      <template #footer>
        <div class="ms-auto">
          <div
              v-if="editedByMyself"
              class="row"
          >
            <div class="col text-end">
              <SidebarButton
                  :loading="false"
                  :props="$props"
                  icon="floppy"
                  :title="$t('common.save')"
                  @click="save"
              />
              <SidebarButton
                  :loading="false"
                  :props="$props"
                  icon="x-square"
                  :title="$t('common.cancel')"
                  @click="cancel"
              />
            </div>
          </div>
          <div
              v-else
              class="row"
          >
            <div class="col">
              <BasicButton
                  v-if="numberReplies > 0"
                  class="btn btn-light btn-sm"
                  data-placement="top"
                  data-toggle="tooltip"
                  :title="$t('common.reply')"
                  :text="showReplies
                    ? $t('common.hideRepliesCount', { count: numberReplies })
                    : $t('common.showReplies', { count: numberReplies })"
                  @click="showReplies = !showReplies; maxComments = defaultNumComments"
              />
            </div>
            <div
                class="col text-end"
            >
              <SidebarButton
                  v-if="settingResponse && !readOnly"
                  :loading="false"
                  :props="$props"
                  icon="reply"
                  :title="$t('common.reply')"
                  @click="$refs.main_comment.reply(); $refs.replies.expandForNewReply()"
              />
              <AnnotationSummarize
                  :annotation-id="annotationId"
                  :comment-id="commentId"
                  @summarized="showReplies = true"
              />
              <VoteButtons :comment="comment"/>
              <SidebarButton
                  v-if="comment.userId === userId && !readOnly"
                  :loading="false"
                  :props="$props"
                  icon="pencil-square"
                  :title="$t('common.edit')"
                  @click="edit"
              />
              <SidebarButton
                v-if="comment.userId === userId && !readOnly && annotationId"
                :loading="false"
                :props="$props"
                icon="tag"
                :title="$t('tags.editMainTag')"
                @click="$refs.annotationTag.toggleEditTag()"
            />
              <SidebarButton
                  v-if="comment.userId === userId && !readOnly"
                  :loading="false"
                  :props="$props"
                  icon="trash3"
                  :title="$t('common.delete')"
                  @click="remove"
              />
            </div>
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
import { formatLocalizedDate, resolveApiMessage } from "@/assets/utils";
import BasicButton from "@/basic/Button.vue";
import AnnotationTag from "./AnnotationTag.vue";
import AnnotationSummarize from "./AnnotationSummarize.vue";
import AnnotationReplies from "./AnnotationReplies.vue";

/** Annotation elements
 *
 * This component holds the current data of each annotation with a comment (and its children).
 *
 * @author Nils Dycke, Dennis Zyska
 *
 */
export default {
  name: "AnnoCard",
  subscribeTable: ['comment_state'],
  components: {VoteButtons, Collaboration, SideCard, Comment, SidebarButton, LoadIcon, BasicButton, AnnotationTag, AnnotationSummarize, AnnotationReplies},
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
  },
  watch: {
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
    toEditMode(status) {
      this.edit_mode = status;
    },
    putFocus() {
      this.shakeIt();
    },
  }
}
</script>

<style>
.replies {
  font-size: smaller;
  color: var(--bs-secondary-color, #929292);
}

@keyframes flickerAnimation {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

@-o-keyframes flickerAnimation {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

@-moz-keyframes flickerAnimation {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

@-webkit-keyframes flickerAnimation {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

.fading {
  -webkit-animation: flickerAnimation 2s infinite;
  -moz-animation: flickerAnimation 2s infinite;
  -o-animation: flickerAnimation 2s infinite;
  animation: flickerAnimation 2s infinite;
}

.check-icon:hover {
  color: var(--bs-primary, #007bff) !important;
}

.header-hoverable {
  transition: background-color 0.2s ease;
}

.header-hoverable:hover {
  background-color: var(--bs-secondary-bg, #e9ecef) !important;
  border-radius: 4px;
}

.card-header {
  font-size: smaller;
  color: var(--bs-secondary-color, #929292);
  transition: background-color 0.2s ease;
}
</style>