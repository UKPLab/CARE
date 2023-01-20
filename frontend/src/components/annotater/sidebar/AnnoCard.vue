<template>
  <SideCard :shake="shake">

    <template v-slot:header>
      <div class="row">
        <div class="col">
          {{ annotation.creator_name }}
          <Collaboration ref="collab"
                         target-type="annotation"
                         :target-id="annotation_id"
                         :document-id="document_id"
                         @collabStatus="toEditMode"></Collaboration>
        </div>
        <div class="col text-end">
          {{ new Date(annotation.updatedAt).toLocaleDateString() }}
        </div>
      </div>
    </template>

    <template v-slot:body>
      <div class="blockquote card-text" :style="'border-color:#' + color" data-placement="top" data-toogle="tooltip"
           :title="tagName" @click="scrollTo(annotation_id)">
        <b>{{ tagName }}:</b> {{ truncatedText(annotation.text) }}
      </div>
      <CommentCard ref="main_comment" @saveCard="save()" :comment_id="comment_id" :edit="editedByMyself"
                   :document_id="document_id"/>
    </template>

    <template v-slot:footer v-if="annotation.userId === user_id">
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
              <span>{{showReplies ? 'Hide' : 'Show'}} Replies ({{ numberReplies }})</span>
            </button>
          </div>
          <div class="col text-end">
            <button v-if="settingResponse" class="btn btn-sm" data-placement="top" data-toggle="tooltip" title="Reply"
                    type="button" v-on:click="$refs.main_comment.reply()">
              <LoadIcon :size="16" iconName="reply-fill"></LoadIcon>
              <span class="visually-hidden">Reply</span>
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
          <CommentCard :document_id="document_id" :comment_id="c.id">
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


export default {
  name: "AnnoCard",
  components: {Collaboration, SideCard, CommentCard, LoadIcon},
  props: ["annotation_id", "readonly", "document_id"],
  data: function () {
    return {
      shake: false,
      showReplies: false,
      showEditTimeout: null,
      edit_mode: false
    }
  },
  mounted() {
    if (this.annotation.draft) {
      //focus (delay necessary, because the sidepane first needs to update the scrollable area before focusing)
      setTimeout(() => this.$emit("focus", this.annotation.id), 100);
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
    comment_id() {
      return this.$store.getters["comment/getCommentByAnnotation"](this.annotation_id)["id"];
    },
    editedByMyself() {
      return this.annotation.draft || this.edit_mode;
    },
    numberReplies() {
      return this.$store.getters["comment/getNumberOfChildrenByComment"](this.comment_id);
    },
    childComments() {
      return this.$store.getters["comment/getCommentsByCommentId"](this.comment_id);
    },
    color() {
      return this.$store.getters['tag/getColor'](this.annotation.tagId);
    },
    tagName() {
      return this.$store.getters['tag/getTag'](this.annotation.tagId).name;
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
    scrollTo(anno_id) {
      this.eventBus.emit('pdfScroll', anno_id);
    },
    save() {
      this.$socket.emit('annotationUpdate', {
        "annotationId": this.annotation.id,
        //TODO tags is not existing anymore in annotation table
        "tagId": JSON.stringify(this.annotation.tagId),
      });
      this.$refs.main_comment.save();
      this.$refs.collab.removeCollab();
    },
    cancel() {
      if (this.annotation.draft) {
        this.remove();
      } else {
        this.$socket.emit('annotationGet', {
          "annotationId": this.annotation.id,
          "documentId": this.document_id
        });
      }
      this.$refs.collab.removeCollab();
      this.edit_mode = null;
    },
    remove() {
      this.$socket.emit('annotationUpdate', {
        "annotationId": this.annotation.id,
        //TODO tags is not existing anymore in annotation table
        "tagId": JSON.stringify(this.annotation.tagId),
        "deleted": true
      });
    },
    edit() {
      this.$refs.collab.startCollab();
    },
    toEditMode(status){
      this.edit_mode = status;
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
</style>