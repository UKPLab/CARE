<template>
  <SideCard :loading="loading()" :shake="shake">

    <template v-slot:header>
      <div class="row">
        <div class="col">
          {{ comment.creator_name }}
          <Collaboration ref="collab"
                         :document-id="document_id"
                         :target-id="comment_id"
                         target-type="comment"
                         @collabStatus="toEditMode"></Collaboration>
          <IconLoading v-if="summarizeRequest" :loading="summarizeRequest" size="12"></IconLoading>

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
      <div v-if="annotation_id" :style="'border-color:#' + color" :title="tagName" class="blockquote card-text"
           data-placement="top"
           data-toogle="tooltip" @click="scrollTo(annotation_id)">
        <b>{{ tagName }}:</b> {{ truncatedText(annotation.text) }}
      </div>
      <CommentCard ref="main_comment" :comment_id="comment_id" :document_id="document_id" :edit="editedByMyself"
                   :level=0
                   @saveCard="save()"/>
    </template>

    <template v-if="comment.userId === user_id" v-slot:footer>
      <div class="ms-auto">
        <div v-if="editedByMyself" class="row">
          <div class="col text-end">
            <button class="btn btn-sm" data-placement="top" data-toggle="tooltip" title="Save"
                    type="button" v-on:click="save()">
              <LoadIcon :size="16" class="danger" iconName="save-fill"></LoadIcon>
              <span class="visually-hidden">Edit</span>
            </button>
            <button class="btn btn-sm" data-placement="top" data-toggle="tooltip" title="Cancel"
                    type="button" v-on:click="cancel()">
              <LoadIcon :size="16" iconName="x-square-fill"></LoadIcon>
              <span class="visually-hidden">Edit</span>
            </button>
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
          <div class="col text-end">
            <button v-if="settingResponse" class="btn btn-sm" data-placement="top" data-toggle="tooltip" title="Reply"
                    type="button" v-on:click="$refs.main_comment.reply()">
              <LoadIcon :size="16" iconName="reply-fill"></LoadIcon>
              <span class="visually-hidden">Reply</span>
            </button>
            <button v-if="summarizationAvailable" :disabled="summarizeRequest" class="btn btn-sm" data-placement="top"
                    data-toggle="tooltip" title="Summarize"
                    type="button" v-on:click="summarize()">
              <LoadIcon :size="16" iconName="file-text"></LoadIcon>
              <span class="visually-hidden">Summarize</span>
            </button>
            <button class="btn btn-sm" data-placement="top" data-toggle="tooltip" title="Edit"
                    type="button" v-on:click="edit()">
              <LoadIcon :size="16" iconName="pencil-square"></LoadIcon>
              <span class="visually-hidden">Edit</span>
            </button>
            <button class="btn btn-sm" data-placement="top" data-toggle="tooltip"
                    title="Delete"
                    type="button" v-on:click="remove()">
              <LoadIcon :size="16" iconName="trash3"></LoadIcon>
              <span class="visually-hidden">Delete</span>
            </button>
          </div>
        </div>
      </div>
    </template>

    <template v-slot:thread>
      <div v-if="showReplies" class="d-grid gap-1 my-2">
        <span v-for="c in childComments" :key="c.id">
          <CommentCard :comment_id="c.id" :document_id="document_id" :level=1>
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
import {v4 as uuidv4} from "uuid";

export default {
  name: "AnnoCard",
  components: {Collaboration, SideCard, CommentCard, LoadIcon, IconLoading},
  props: ["comment_id", "readonly", "document_id"],
  data: function () {
    return {
      shake: false,
      showReplies: false,
      showEditTimeout: null,
      edit_mode: false,
      summarizeRequest: null,
    }
  },
  watch: {
    nlpResults: function (results) {
      if (this.summarizeRequest &&
          this.summarizeRequest in results
      ) {
        this.$socket.emit('commentAdd', {
          "documentId": this.document_id,
          "commentId": this.comment_id,
          "text": results[this.summarizeRequest][0]['summary_text'],
          "userId": "Bot"
        });
      }
    },
  },
  mounted() {
    if (this.comment.draft) {
      //focus (delay necessary, because the sidepane first needs to update the scrollable area before focusing)
      setTimeout(() => this.$emit("focus", this.comment_id), 100);
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
      const annotationId = this.comment.referenceAnnotation;
      if (annotationId)
        return annotationId;
    },
    editedByMyself() {
      return this.comment.draft || this.edit_mode;
    },
    numberReplies() {
      return this.$store.getters["comment/getNumberOfChildrenByComment"](this.comment_id);
    },
    childComments() {
      return this.$store.getters["comment/getCommentsByCommentId"](this.comment_id);
    },
    comment() {
      return this.$store.getters['comment/getComment'](this.comment_id);
    },
    color() {
      if (this.annotation_id)
        return this.$store.getters['tag/getColor'](this.annotation.tagId);
    },
    tagName() {
      if (this.annotation_id)
        return this.$store.getters['tag/getTag'](this.annotation.tagId).name;
    },
    settingSummarizationMinLength() {
      return parseInt(this.$store.getters["settings/getValue"]('annotator.nlp.summarization.minLength'));
    },
    settingSummarizationMaxLength() {
      return parseInt(this.$store.getters["settings/getValue"]('annotator.nlp.summarization.maxLength'));
    },
    settingSummarizationAnnoLength() {
      return parseInt(this.$store.getters["settings/getValue"]('annotator.nlp.summarization.annoLength'));
    },
    settingSummarizationTimeout() {
      return parseInt(this.$store.getters["settings/getValue"]('annotator.nlp.summarization.timeout'));
    },
    settingSummarizationActivated() {
      return this.$store.getters["settings/getValue"]('annotator.nlp.summarization.activated') === "true";
    },
    settingSummarizationSkillName() {
      return this.$store.getters["settings/getValue"]('annotator.nlp.summarization.skillName');
    },
    summarizationAvailable() {
      return this.annotation.text !== null && this.annotation.text.length >= this.settingSummarizationAnnoLength
          && this.settingSummarizationActivated && this.nlpSkills.includes(this.settingSummarizationSkillName);
    },
    nlpSkills() {
      return this.$store.getters["service/getNLPSkills"];
    },
    nlpResults() {
      return this.$store.getters["service/getNLPResults"];
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
            "documentId": this.document_id
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
    summarize() {
      this.summarizeRequest = uuidv4();
      this.$socket.emit("serviceRequest",
          {
            service: "NLPService",
            data: {
              id: this.summarizeRequest,
              name: this.settingSummarizationSkillName,
              data: {
                text: this.annotation.text,
                params: {
                  min_length: this.settingSummarizationMinLength,
                  max_length: this.settingSummarizationMaxLength
                }
              }
            }
          }
      );
      setTimeout(() => {
        if (this.summarizeRequest) {
          this.eventBus.emit('toast', {
            title: "Summarization Request",
            message: "Timeout in summarization request. Request failed.",
            variant: "danger"
          });
          this.summarizeRequest = null;
        }
      }, this.settingSummarizationTimeout);


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
</style>