<template>
  <SideCard
    :loading="loading()"
    :shake="shake"
  >
    <template #header>
      <div class="row">
        <div class="col">
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
            {{ new Date(annotation.updatedAt).toLocaleDateString() }}
          </span>
          <span v-else>
            {{ new Date(comment.updatedAt).toLocaleDateString() }}
          </span>
        </div>
      </div>
    </template>

    <template #body>
      <div
        v-if="annotationId"
        :style="'border-color:#' + color"
        :title="tagName"
        class="blockquote card-text annoBlockquote"
        data-placement="top"
        data-toogle="tooltip"
        @click="scrollTo(annotationId)"
      >
        <b>{{ tagName }}:</b> {{ truncatedText(annotation.text) }}
      </div>
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
              icon="save-fill"
              title="Save"
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
          <div class="col">
            <button
              v-if="numberReplies > 0"
              class="btn btn-sm"
              data-placement="top"
              data-toggle="tooltip"
              title="Reply"
              type="button"
              @click="showReplies = !showReplies"
            >
              <!--<LoadIcon :size="16" :iconName="showReplies ? 'arrow-down-short': 'arrow-right-short'"></LoadIcon>-->
              <span>{{ showReplies ? 'Hide' : 'Show' }} Replies ({{ numberReplies }})</span>
            </button>
          </div>
          <div
            class="col text-end"
          >
            <SidebarButton
              v-if="settingResponse && !readonly"
              :loading="false"
              :props="$props"
              icon="reply-fill"
              title="Reply"
              @click="$refs.main_comment.reply();showReplies = true"
            />
            <NLPService
              v-if="summarizationAvailable && comment.userId === userId && !readonly"
              :data="summarizationRequestData"
              :skill="summarizationSkillName"
              icon-name="file-text"
              title="Summarize"
              type="button"
              @response="summarizeResponse"
            />
            <VoteButtons :comment="comment" />
            <SidebarButton
              v-if="comment.userId === userId && !readonly"
              :loading="false"
              :props="$props"
              icon="pencil-square"
              title="Edit"
              @click="edit"
            />
            <SidebarButton
              v-if="comment.userId === userId && !readonly"
              :loading="false"
              :props="$props"
              icon="trash3"
              title="Delete"
              @click="remove"
            />
          </div>
        </div>
      </div>
    </template>

    <template #thread>
      <div
        v-if="showReplies"
        class="d-grid gap-1 my-2"
      >
        <span
          v-for="c in childComments"
          :key="c.id"
        >
          <Comment
            :comment-id="c.id"
            :level="1"
          />
        </span>
      </div>
    </template>
  </SideCard>
</template>

<script>
import SideCard from "./Card.vue";
import Comment from "./Comment.vue";
import Collaboration from "@/basic/Collaboration.vue"
import SidebarButton from "./Button.vue"
import NLPService from "@/basic/NLPService.vue";
import VoteButtons from "@/components/annotator/sidebar/card/VoteButtons.vue";

/** Annotation elements
 *
 * This component holds the current data of each annotation with a comment (and its children).
 *
 * @author Nils Dycke, Dennis Zyska
 *
 */
export default {
  name: "AnnoCard",
  components: {VoteButtons, NLPService, Collaboration, SideCard, Comment, SidebarButton},
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
    }
  },
  props: {
    'commentId': {
      type: Number,
      required: true,
    },
  },
  emits: ['focus'],
  data: function () {
    return {
      shake: false,
      showReplies: false,
      edit_mode: false,
    }
  },
  computed: {
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
    childComments() {
      return this.$store.getters["table/comment/getByKey"]("parentCommentId", this.commentId).sort(
        function (a, b) {
          let keyA = new Date(a.createdAt), keyB = new Date(b.createdAt);
          if (keyA < keyB) return -1;
          if (keyA > keyB) return 1;
          return 0;
        }
      );
    },
    comment() {
      return this.$store.getters['table/comment/get'](this.commentId);
    },
    color() {
      if (this.annotationId)
        return this.getColor(this.annotation.tagId);
      return null;
    },
    tagName() {
      if (this.annotationId) {
        const tag = this.$store.getters['table/tag/get'](this.annotation.tagId);
        if (tag)
          return tag.name;
      }
      return null;
    },
    summarizationMinLength() {
      return parseInt(this.$store.getters["settings/getValue"]('annotator.nlp.summarization.minLength'));
    },
    summarizationMaxLength() {
      return parseInt(this.$store.getters["settings/getValue"]('annotator.nlp.summarization.maxLength'));
    },
    summarizationRequestData() {
      return {
        text: this.annotation.text,
        params: {
          min_length: this.summarizationMinLength,
          max_length: this.summarizationMaxLength
        }
      }
    },
    summarizationMinAnnoLength() {
      return parseInt(this.$store.getters["settings/getValue"]('annotator.nlp.summarization.annoLength'));
    },
    summarizationActivated() {
      return this.$store.getters["settings/getValue"]('annotator.nlp.summarization.activated') === "true";
    },
    summarizationSkillName() {
      return this.$store.getters["settings/getValue"]('annotator.nlp.summarization.skillName');
    },
    nlpEnabled() {
      return this.$store.getters["settings/getValue"]("service.nlp.enabled") === "true";
    },
    summarizationAvailable() {
      if (!this.nlpEnabled)
        return false;
      if (this.annotation)
        return this.annotation.text !== null && this.annotation.text.length >= this.summarizationMinAnnoLength
          && this.summarizationActivated;
      return null;
    },
  },
  mounted() {
    if (this.comment.draft) {
      //focus (delay necessary, because the sidepane first needs to update the scrollable area before focusing)
      setTimeout(() => this.$emit("focus", this.commentId), 100);
      this.shakeIt();
    }
  },
  methods: {
    getColor(tagId) {
      if (tagId) {
        const tag = this.$store.getters['table/tag/get'](tagId);
        if (tag) {
          switch (tag.colorCode) {
            case "success":
              return "009933";
            case "danger":
              return "e05f5f";
            case "info":
              return "5fe0df";
            case "dark":
              return "c8c8c8";
            case "warning":
              return "eed042";
            case "secondary":
              return "4290ee";
            default:
              return "4c86f7";
          }
        } else {
          return "efea7b";
        }
      }
    },
    shakeIt() {
      this.shake = true;
      setTimeout(() => this.shake = false, 1500);
    },
    truncatedText(text) {
      const thresh = 150;
      const len = text.length;

      if (len > thresh) {
        const overflow = len - thresh - " ... ".length;
        const center = Math.floor(len / 2);
        const cutoff_l = center - Math.floor(overflow / 2);
        const cutoff_r = center + Math.floor(overflow / 2) + overflow % 2;

        return text.slice(0, cutoff_l) + " ... " + text.slice(cutoff_r);
      } else {
        return text;
      }
    },
    loading() {
      if (this.annotationId && !this.annotation) {
        return true;
      }
      return false;
    },
    scrollTo(annotationId) {
      this.eventBus.emit('pdfScroll', annotationId);
    },
    save() {
      if (this.annotationId) {
        this.$socket.emit('annotationUpdate', {
          "annotationId": this.annotation.id,
          "tagId": JSON.stringify(this.annotation.tagId),
        });
      }

      this.$refs.main_comment.save();
      this.$refs.collab.removeCollab();
    },
    cancel() {
      if (this.annotationId) {

        if (this.annotation.draft) {
          this.remove();
        } else {
          this.$socket.emit('annotationGet', {
            "annotationId": this.annotation.id,
            "documentId": this.documentId
          });
        }
      } else {
        if (this.comment.draft) {
          this.remove();
        } else {
          this.$socket.emit('commentGet', {
            "commentId": this.comment.id,
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
          "tagId": JSON.stringify(this.annotation.tagId),
          "deleted": true
        });
      } else {
        this.$socket.emit('commentUpdate', {
          "commentId": this.comment.id,
          "deleted": true
        });
      }
    },
    edit() {
      this.$refs.collab.startCollab();
    },
    toEditMode(status) {
      this.edit_mode = status;
    },
    summarizeResponse(data) {
      this.$socket.emit('commentUpdate', {
        "documentId": this.documentId,
        "parentCommentId": this.commentId,
        "studySessionId": this.studySessionId,
        "studyStepId": this.studyStepId,
        "text": "Summarization: " + data[0]['summary_text'],
        "userId": "Bot"
      });
      this.showReplies = true;
    },
    putFocus() {
      this.shakeIt();
    },
  }
}
</script>

<style>
.blockquote {
  padding-left: 1em;
  padding-right: 1em;
  font-style: italic;
  --tw-border-opacity: 1;
  border-color: rgba(209, 213, 219, var(--tw-border-opacity));
  border-sizing: border-box;
  border-style: solid;
  border-left-width: 4px;
  font-size: small;
  border-right-width: 0;
  border-top-width: 0;
  border-bottom-width: 0;
  cursor: pointer;
}


.replies {
  font-size: smaller;
  color: #929292;
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

.annoBlockquote:hover {
  color: #000000;
}
</style>