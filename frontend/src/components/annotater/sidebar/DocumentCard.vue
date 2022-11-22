<template>
  <!--

  1. has reference for annotation
  2. has no reference for annotation, but has a document comment
  3. has reference for annotation and comment

  -->

  <b-card :class="{ shake: shake }">
    <div class="card-header">
      <div class="container-fluid">
        <div class="row">
          <div class="col" id="pageNoteFlag" v-if="isPageNote">
            <a>Document Note</a>
          </div>
          <div class="col">
            <a id="user_info">User: {{ annotation.user }}</a>
          </div>
        </div>
      </div>
    </div>
    <div class="card-body" :class="{pageNoteBody: isPageNote}">
      <div class="d-grid gap-1">
        <blockquote v-if="!isPageNote"
                    id="text"
                    class="blockquote card-text"
                    v-on:click="scrollTo(annotation.id)">
          {{ truncatedText }}
        </blockquote>
        <div v-else id="text" class="blockquote card-text">
        </div>
        <div v-if="!isEdited" id="comment">
          <textarea id="annoComment"
                    v-model="annoComment"
                    class="form-control"
                    placeholder="Enter text..."
                    @keydown.ctrl.enter="submit()">
          </textarea>
        </div>
        <div v-else-if="annotation.comment != null && annotation.comment.text.length > 0" id="comment"
             class="card-text">
          {{ annotation.comment.text }}
        </div>
        <div>
          <TagSelector :disabled="!editedByMyself" :annotation="annotation"></TagSelector>
        </div>
        <div v-if="editedByMyself" id="createButtons" class="btn-group btn-group-sm" role="group">
          <button class="btn btn-primary" type="button" v-on:click="submit()">Submit</button>
          <button class="btn btn-danger" type="button" v-on:click="remove()">Discard</button>
        </div>
      </div>
    </div>
    <div v-if="!editedByMyself && !readonly" class="card-footer">
      <div id="footer-controls" class="container">
        <div class="row">
          <div id="edit-buttons" class="col text-start">
            <button class="btn btn-outline-secondary" data-placement="top" data-toggle="tooltip" title="Edit annotation"
                    type="button" v-on:click="edit()">
              <svg class="bi bi-pencil-square" fill="currentColor" height="16" viewBox="0 0 16 16"
                   width="16" xmlns="http://www.w3.org/2000/svg">
                <path
                    d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/>
                <path
                    d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z"
                    fill-rule="evenodd"/>
              </svg>
              <span class="visually-hidden">Edit</span>
            </button>
            <button class="btn btn-outline-secondary" data-placement="top" data-toggle="tooltip"
                    title="Delete annotation"
                    type="button" v-on:click="remove()">
              <svg class="bi bi-trash3" fill="currentColor" height="16" viewBox="0 0 16 16" width="16"
                   xmlns="http://www.w3.org/2000/svg">
                <path
                    d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5ZM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.506a.58.58 0 0 0-.01 0H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1h-.995a.59.59 0 0 0-.01 0H11Zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5h9.916Zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47ZM8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5Z"/>
              </svg>
              <span class="visually-hidden">Delete</span>
            </button>
          </div>
          <!-- Add later
          <div class="col text-end">
            <button class="btn btn-outline-secondary" data-placement="top" data-toggle="tooltip" title="Respond to annotation"
                    type="button">
              <svg class="bi bi-arrow-90deg-left" fill="currentColor" height="16" viewBox="0 0 16 16"
                   width="16" xmlns="http://www.w3.org/2000/svg">
                <path d="M1.146 4.854a.5.5 0 0 1 0-.708l4-4a.5.5 0 1 1 .708.708L2.707 4H12.5A2.5 2.5 0 0 1 15 6.5v8a.5.5 0 0 1-1 0v-8A1.5 1.5 0 0 0 12.5 5H2.707l3.147 3.146a.5.5 0 1 1-.708.708l-4-4z"
                      fill-rule="evenodd"/>
              </svg>
              <span class="visually-hidden">Respond</span>
            </button>
          </div>
          -->
        </div>
      </div>
    </div>
  </b-card>
</template>

<script>
/* AnnoCard.vue - annotation elements

This component holds the current data of each annotation and handles the annotation functionality itself

Author: Nils Dycke (dycke@ukp...)
Source: -
*/

import {mapActions, mapGetters} from 'vuex';
import {Comment} from "../../../data/comment.js";
import TagSelector from "./TagSelector.vue";

export default {
  name: "DocumentCard",
  components: {TagSelector},
  props: ["readonly", "document_id", "comment_id"],
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
      setTimeout(() => this.shake = false, 800);
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






    hasComment() {
      return this.$store.getters["anno/hasComment"](this.annotation_id);
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
    ...mapActions({
      deleteAnnotation: "anno/deleteAnnotation"
    }),
    scrollTo(anno_id) {
      this.eventBus.emit('pdfScroll', anno_id);
    },
    submit() {
      this.toSubmitState();

      this.$socket.emit('updateAnnotation', {
        "id": this.annotation.id,
        "tags": JSON.stringify(this.annotation.tags),
        "draft": false
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
      if (this.collab_updater) {
        clearInterval(this.collab_updater);
        this.collab_updater = null;
      }

    },
    remove() {
      this.annotation.state = "DELETED";
      this.deleteAnnotation(this.annotation);
      this.$socket.emit('deleteAnnotation', {
        "id": this.annotation.id
      });
    },
    respond() {
      // TODO implement respond function
      console.log("A user tries to respond");
    },
  }
}
</script>

<style>
.shake {
  animation: shake 0.82s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
  transform: translate3d(0, 0, 0);
}

@keyframes shake {
  10%,
  90% {
    transform: translate3d(-1px, 0, 0);
  }

  20%,
  80% {
    transform: translate3d(2px, 0, 0);
  }

  30%,
  50%,
  70% {
    transform: translate3d(-4px, 0, 0);
  }

  40%,
  60% {
    transform: translate3d(4px, 0, 0);
  }
}

.card-body .card-header {
  text-align: right;
  font-size: smaller;
  color: #929292;

  padding-left: 4px;
  padding-right: 4px;
}

.card .card-body {
  padding: 0;
}

.card .card-body .card-body {
  padding-left: 8px;
  padding-right: 8px;
  padding-top: 4px;
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

.card-body .card-footer {
  padding: 0;
}

#footer-controls {
  padding: 4px;
}

#footer-controls .btn {
  border: none;
}

#tags div {
  padding-left: 0;
  padding-right: 0;
  border: none;
  background-color: transparent;
}

#createButtons {
  padding-bottom: 6px;
}

#pageNoteFlag {
  text-align: left
}

.pageNoteBody {
  background-color: rgba(0, 0, 0, 0.05);
}
</style>