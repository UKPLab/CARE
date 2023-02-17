<template>
  <SideCard :loading="loading()" :shake="shake">
    <template v-slot:header>
      <div class="row">
        <div class="col">
          {{ comment.creator_name }}
          <Collaboration ref="collab"
                         :document-id="documentId"
                         :target-id="commentId"
                         target-type="comment"
                         @collabStatus="toEditMode"></Collaboration>

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

    <template v-slot:body>
      <div v-if="annotation_id" :style="'border-color:#' + color" :title="tagName" class="blockquote card-text annoBlockquote"
           data-placement="top"
           data-toogle="tooltip" @click="scrollTo(annotation_id)">
        <b>{{ tagName }}:</b> {{ truncatedText(annotation.text) }}
      </div>
      <CommentCard ref="main_comment" :commentId="commentId" :documentId="documentId" :edit="editedByMyself" :study-session-id="studySessionId" :readonly="readonly"
                   :level=0
                   @saveCard="save()"/>
    </template>

    <template v-slot:footer>
      <div class="ms-auto">
        <div v-if="editedByMyself" class="row">
          <div class="col text-end">
            <SidebarButton :loading="false"
                           :props="this.$props"
                           icon="save-fill"
                           title="Save"
                           @click="save" />
            <SidebarButton :loading="false"
                           :props="this.$props"
                           icon="x-square-fill"
                           title="Cancel"
                           @click="cancel" />
          </div>
        </div>
        <div v-else class="row">
          <div class="col">
            <button v-if="numberReplies > 0" class="btn btn-sm" data-placement="top" data-toggle="tooltip" title="Reply"
                    type="button" v-on:click="showReplies = !showReplies">
              <!--<LoadIcon :size="16" :iconName="showReplies ? 'arrow-down-short': 'arrow-right-short'"></LoadIcon>-->
              <span>{{ showReplies ? 'Hide' : 'Show' }} Replies ({{ numberReplies }})</span>
            </button>
          </div>
          <div v-if="!readonly" class="col text-end">
            <SidebarButton v-if="settingResponse"
                           :loading="false"
                           :props="this.$props"
                           icon="reply-fill"
                           title="Reply"
                           @click="$refs.main_comment.reply();showReplies = !showReplies" />
            <NLPService
                v-if="summarizationAvailable && comment.userId === user_id"
                :data="summarizationRequestData"
                :skill="summarizationSkillName"
                icon-name="file-text"
                title="Summarize"
                type="button"
                @response="summarizeResponse"
            ></NLPService>
            <SidebarButton v-if="comment.userId === user_id"
                           :loading="false"
                           :props="this.$props"
                           icon="pencil-square"
                           title="Edit"
                           @click="edit" />
            <SidebarButton v-if="comment.userId === user_id"
                           :loading="false"
                           :props="this.$props"
                           icon="trash3"
                           title="Delete"
                           @click="remove" />
          </div>
        </div>
      </div>
    </template>

    <template v-slot:thread>
      <div v-if="showReplies" class="d-grid gap-1 my-2">
        <span v-for="c in childComments" :key="c.id">
          <CommentCard :readonly="readonly" :study-session-id="studySessionId" :commentId="c.id" :documentId="documentId" :level=1>
        </CommentCard>
        </span>
      </div>
    </template>

  </SideCard>
</template>

<script>
/* AnnoCard.vue - annotation elements

This component holds the current data of each annotation and handles the annotation functionality itself

Author: Nils Dycke (dycke@ukp...)
Source: -
*/

import SideCard from "./SideCard.vue";
import CommentCard from "./CommentCard.vue";
import LoadIcon from "@/icons/LoadIcon.vue";
import Collaboration from "@/basic/Collaboration.vue"
import IconLoading from "@/icons/IconLoading.vue"
import SidebarButton from "./SidebarButton.vue"

import NLPService from "@/basic/NLPService.vue";

export default {
  name: "AnnoCard",
  components: {NLPService, Collaboration, SideCard, CommentCard, LoadIcon, IconLoading, SidebarButton},
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
  },
  data: function () {
    return {
      shake: false,
      showReplies: false,
      showEditTimeout: null,
      edit_mode: false,
    }
  },
  mounted() {
    if (this.comment.draft) {
      //focus (delay necessary, because the sidepane first needs to update the scrollable area before focusing)
      setTimeout(() => this.$emit("focus", this.commentId), 100);
      this.shake = true;
      setTimeout(() => this.shake = false, 1500);
    }
  },
  computed: {
    user_id() {
      return this.$store.getters["auth/getUserId"];
    },
    settingResponse() {
      return this.$store.getters["settings/getValue"]('annotator.collab.response') === "true";
    },
    annotation() {
      return this.$store.getters["anno/getAnnotation"](this.annotation_id);
    },
    annotation_id() {
      const annotationId = this.comment.annotationId;
      if (annotationId)
        return annotationId;
    },
    editedByMyself() {
      return this.comment.draft || this.edit_mode;
    },
    numberReplies() {
      return this.$store.getters["comment/getNumberOfChildrenByComment"](this.commentId);
    },
    childComments() {
      return this.$store.getters["comment/getCommentsByCommentId"](this.commentId);
    },
    comment() {
      return this.$store.getters['comment/getComment'](this.commentId);
    },
    color() {
      if (this.annotation_id)
        return this.$store.getters['tag/getColor'](this.annotation.tagId);
    },
    tagName() {
      if (this.annotation_id) {
        const tag = this.$store.getters['tag/getTag'](this.annotation.tagId);
        if (tag)
          return tag.name;
      }
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
    summarizationAvailable() {
      if (this.annotation)
      return this.annotation.text !== null && this.annotation.text.length >= this.summarizationMinAnnoLength
          && this.summarizationActivated;
    },
  },
  methods: {
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
      if (this.annotation_id && !this.annotation) {
        return true;
      }
      return false;
    },
    scrollTo(anno_id) {
      this.eventBus.emit('pdfScroll', anno_id);
    },
    save() {
      if (this.annotation_id) {
        this.$socket.emit('annotationUpdate', {
          "annotationId": this.annotation.id,
          //TODO tags is not existing anymore in annotation table
          "tagId": JSON.stringify(this.annotation.tagId),
        });
      }

      this.$refs.main_comment.save();
      this.$refs.collab.removeCollab();
    },
    cancel() {
      if (this.annotation_id) {

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
      if (this.annotation_id) {
        this.$socket.emit('annotationUpdate', {
          "annotationId": this.annotation.id,
          //TODO tags is not existing anymore in annotation table
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
      this.$socket.emit('commentAdd', {
        "documentId": this.documentId,
        "commentId": this.commentId,
        "studySessionId": this.studySessionId,
        "text": "Summarization: " + data[0]['summary_text'],
        "userId": "Bot"
      });
      this.showReplies = !this.showReplies;
    }
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