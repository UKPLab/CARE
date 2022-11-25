<template>
  <SideCard :shake="shake">

    <template v-slot:header>
      <div class="row">
        <div class="col">
          {{ annotation.creator_name }}
          <span v-if="showEditByCollab">
            <LoadIcon :size="12 " class="fading" iconName="IconPencilFill"></LoadIcon>
          </span>

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
      <CommentCard ref="main_comment" @saveCard="save()" :comment_id="comment_id" :edit="editedByMyself"/>
    </template>

    <template v-slot:footer v-if="annotation.creator === user_id">
      <div class="ms-auto">
        <div v-if="editedByMyself" class="row">
          <div class="col text-end">
            <button class="btn btn-sm" data-placement="top" data-toggle="tooltip" title="Save"
                    type="button" v-on:click="save()">
              <LoadIcon :size="16" class="danger" iconName="IconSaveFill"></LoadIcon>
              <span class="visually-hidden">Edit</span>
            </button>
            <button class="btn btn-sm" data-placement="top" data-toggle="tooltip" title="Cancel"
                    type="button" v-on:click="cancel()">
              <LoadIcon :size="16" iconName="IconXSquareFill"></LoadIcon>
              <span class="visually-hidden">Edit</span>
            </button>
          </div>
        </div>
        <div v-else class="row">
          <div class="col">
            <span v-if="numberReplies > 0" class="replies">Show Replies ({{ numberReplies }})</span>
          </div>
          <div class="col text-end">
            <!--<button class="btn btn-sm" data-placement="top" data-toggle="tooltip" title="Reply"
                    type="button" v-on:click="reply()">
              <LoadIcon :size="16" iconName="IconReplyFill"></LoadIcon>
              <span class="visually-hidden">Edit</span>
            </button>-->
            <button class="btn btn-sm" data-placement="top" data-toggle="tooltip" title="Edit"
                    type="button" v-on:click="edit()">
              <LoadIcon :size="16" iconName="IconPencilSquare"></LoadIcon>
              <span class="visually-hidden">Edit</span>
            </button>
            <button class="btn btn-sm" data-placement="top" data-toggle="tooltip"
                    title="Delete"
                    type="button" v-on:click="remove()">
              <LoadIcon :size="16" iconName="IconTrash3"></LoadIcon>
              <span class="visually-hidden">Delete</span>
            </button>
          </div>
        </div>
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

import {mapActions, mapGetters} from 'vuex';
import SideCard from "./SideCard.vue";
import CommentCard from "./CommentCard.vue";
import LoadIcon from "../../../icons/LoadIcon.vue";
import {v4 as uuidv4} from 'uuid';


export default {
  name: "AnnoCard",
  components: {SideCard, CommentCard, LoadIcon},
  props: ["annotation_id", "readonly", "document_id"],
  data: function () {
    return {
      shake: false,
      edit_mode: false,
      collab_updater: null,
      collab_id: null,
      showEditByCollab: false,
      showEditTimeout: null,
    }
  },
  sockets: {
    start_collab: function (data) {
      if (data.id === this.collab_id) {
        this.edit_mode = true;
        if (this.collab_updater !== null) {
          clearInterval(this.collab_updater);
        }
        this.collab_updater = setInterval(() => {
          this.update_collab();
        }, 1000);
      }
    }
  },
  mounted() {
    if (this.annotation.draft) {
      //focus (delay necessary, because the sidepane first needs to update the scrollable area before focusing)
      setTimeout(() => this.$emit("focus", this.annotation.id), 100);
      this.shake = true;
    }
  },
  unmounted() {
    if (this.edit_mode) {
      this.remove_collab();
    }
  },
  watch: {
    collaborations(t) {
      if (t.length > 0) {
        this.showEditByCollab = true;
        if (this.showEditTimeout !== null) {
          clearTimeout(this.showEditTimeout);
        }
        this.showEditTimeout = setTimeout(() => {
          this.showEditByCollab = false;
          this.showEditTimeout = null;
        }, 1000);
      }
    }
  },
  computed: {
    user_id() {
      return this.$store.getters["auth/getUserId"];
    },
    annotation() {
      return this.$store.getters["anno/getAnnotation"](this.annotation_id);
    },
    collaborations() {
      return this.$store.getters["collab/annotations"](this.annotation_id);
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
    color() {
      return this.$store.getters['tag/getColor'](this.annotation.tag);
    },
    tagName() {
      return this.$store.getters['tag/getTag'](this.annotation.tag).name;
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
      this.$socket.emit('updateAnnotation', {
        "id": this.annotation.id,
        "tags": JSON.stringify(this.annotation.tags),
      });
      this.$refs.main_comment.save();
      this.remove_collab();
    },
    cancel() {
      if (this.annotation.draft) {
        this.remove();
      } else {
        this.$socket.emit('getAnnotation', {
          "id": this.annotation.id,
          "document_id": this.document_id
        });
      }
      this.remove_collab();
      this.edit_mode = null;
    },
    remove() {
      this.$socket.emit('updateAnnotation', {
        "id": this.annotation.id,
        "tags": JSON.stringify(this.annotation.tags),
        "deleted": true
      });
    },
    edit() {
      this.start_collab();
    },
    start_collab() {
      this.collab_id = uuidv4();
      this.$socket.emit("add_collab",
          {
            type: "annotation",
            doc_id: this.document_id,
            annotation_id: this.annotation_id,
            id: this.collab_id
          });
    },
    update_collab() {
      this.$socket.emit("update_collab", {id: this.collab_id});
    },
    remove_collab() {
      this.$socket.emit("remove_collab", {id: this.collab_id});
      if (this.collab_updater !== null) {
        clearInterval(this.collab_updater);
        this.collab_updater = null;
      }
      this.edit_mode = false;
      this.collab_id = null;
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


#text {
  color: #4d4d4d;
  font-style: italic;
  font-size: small;
  cursor: pointer;
  display: block;
  padding: 0;
}

#text:hover {
  color: #000000;
}

#createButtons {
  padding-bottom: 6px;
}

.replies {
  font-size: smaller;
  color: #929292;
}

#pageNoteFlag {
  text-align: left
}

.pageNoteBody {
  background-color: rgba(0, 0, 0, 0.05);
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