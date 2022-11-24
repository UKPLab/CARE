<template>
  <SideCard :shake="shake">

    <template v-slot:header>
      <div class="row">
        <div class="col">
          {{ annotation.creator_name }}
        </div>
        <div class="col text-end">
          {{ new Date(annotation.updatedAt).toLocaleDateString() }}
        </div>
      </div>
    </template>

    <template v-slot:body>
      <div class="blockquote card-text" :style="'border-color:#' + color" data-placement="top"  data-toogle="tooltip" :title="tagName">
        {{ annotation.text }}
      </div>
      <CommentCard ref="main_comment" :annotation_id="annotation_id" :edit="editedByMyself"/>
    </template>

    <template v-slot:footer>
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
            <button class="btn btn-sm" data-placement="top" data-toggle="tooltip" title="Reply"
                    type="button" v-on:click="reply()">
              <LoadIcon :size="16" iconName="IconReplyFill"></LoadIcon>
              <span class="visually-hidden">Edit</span>
            </button>
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

export default {
  name: "AnnoCard",
  components: {SideCard, CommentCard, LoadIcon},
  props: ["annotation_id", "readonly", "document_id"],
  data: function () {
    return {
      shake: false,
      edit_mode: null,
      collab_updater: null,
    }
  },
  sockets: {
    start_collab: function (data) {
      this.edit_mode = data.id;
      if (this.collab_updater !== null) {
        clearInterval(this.collab_updater);
      }
      this.collab_updater = setInterval(() => {
        this.update_collab();
      }, 1000);
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
  computed: {
    annotation() {
      return this.$store.getters["anno/getAnnotation"](this.annotation_id);
    },
    collaborations() {
      return this.$store.getters["collab/annotations"](this.annotation_id);
    },
    isEdited() {
      return this.collaborations.length > 0;
    },
    editedByMyself() {
      return this.annotation.draft || this.edit_mode !== null;
    },
    numberReplies() {
      return this.$store.getters["comment/getCommentsByAnnotation"](this.annotation_id).length;
    },
    color() {
      return this.$store.getters['tag/getColor'](this.annotation.tags[0]);
    },
    tagName() {
      return this.$store.getters['tag/getTag'](this.annotation.tags[0]).name;
    },
    /*
    annoComment: {
      get() {
        return this.hasComment ? this.annotation.comment.text : "";
      },
      set(value) {
        if (!this.hasComment) {
          this.annotation.comment = new Comment(null, value, this.annotation.id, null, this.$store.getters["auth/getUser"].id);
        } else {
          this.annotation.comment.text = value;
        }
      }
    },*/
    isPageNote() {
      return this.annotation.text === null || this.annotation.text.length === 0;
    },
    truncatedText: function () {
      const thresh = 150;
      const len = this.annotation.text.length;

      if (len > thresh) {
        const overflow = len - thresh - " ... ".length;
        const center = Math.floor(len / 2);
        const cutoff_l = center - Math.floor(overflow / 2);
        const cutoff_r = center + Math.floor(overflow / 2) + overflow % 2;

        return this.annotation.text.slice(0, cutoff_l) + " ... " + this.annotation.text.slice(cutoff_r);
      } else {
        return this.annotation.text;
      }
    }
  },

  methods: {
    scrollTo(anno_id) {
      this.eventBus.emit('pdfScroll', anno_id);
    },
    save() {
      this.$socket.emit('updateAnnotation', {
        "id": this.annotation.id,
        "tags": JSON.stringify(this.annotation.tags),
        "draft": false
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
      this.$socket.emit("add_collab", {type: "annotation", doc_id: this.document_id, id: this.annotation_id});
    },
    update_collab() {
      this.$socket.emit("update_collab", {id: this.edit_mode});
    },
    remove_collab() {
      this.$socket.emit("remove_collab", {id: this.edit_mode});
      if (this.collab_updater !== null) {
        clearInterval(this.collab_updater);
        this.collab_updater = null;
      }

    },

    respond() {
      // TODO implement respond function
      console.log("A user tries to respond");
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
</style>