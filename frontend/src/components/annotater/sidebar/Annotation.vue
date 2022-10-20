<template>
  <b-card :class="{ shake: input_required }">
    <div class="card-header">
      <div class="container-fluid">
        <div class="row">
          <div class="col" id="pageNoteFlag" v-if="isPageNote">
            <a>Document Note</a>
          </div>
          <div class="col">
            <a id="user_info">User: {{ annoData.user }}</a>
          </div>
        </div>
      </div>
    </div>
    <div class="card-body" :class="{pageNoteBody: isPageNote}">
      <div class="d-grid gap-1">
        <blockquote v-if="!isPageNote"
                    id="text"
                    class="blockquote card-text"
                    v-on:click="scrollTo(annoData.id)">
          {{ truncatedText }}
        </blockquote>
        <div v-else id="text" class="blockquote card-text">
        </div>
        <div v-if="!isSubmitted" id="comment">
          <textarea id="annoComment"
                    v-model="annoComment"
                    class="form-control"
                    placeholder="Enter text..."
                    @keydown.ctrl.enter="submit()">
          </textarea>
        </div>
        <div v-else-if="annoData.comment != null && annoData.comment.text.length > 0" id="comment" class="card-text">
          {{ annoData.comment.text }}
        </div>
        <div id="tags" v-bind:disabled="isSubmitted" v-bind:uid="'tags'+annoData.id">
          <select v-bind:id="'annotationTags-'+annoData.id"
                  v-model="annoTags"
                  allowClear="true"
                  class="form-select"
                  data-allow-new="true"
                  multiple
                  name="tags_new[]"
                  placeholder="Add tag..."
                  v-bind:disabled="isSubmitted">
            <option disabled hidden selected value="">Choose a tag...</option>
            <option v-for="t in assignableTags" :key="t.name" v-bind:data-badge-style="t.colorCode" v-bind:value="t.description">{{t.description}}</option>
            <option v-for="t in nonActiveTags" :key="t.name" selected="true" :data-badge-style="t.colorCode" :value="t.description">{{t.description}}</option>
          </select>
          <div class="invalid-feedback">Please select a valid tag.</div>
        </div>
        <div v-if="!isSubmitted" id="createButtons" class="btn-group btn-group-sm" role="group">
          <button class="btn btn-primary" type="button" v-on:click="submit()">Submit</button>
          <button class="btn btn-danger" type="button" v-on:click="remove()">Discard</button>
        </div>
      </div>
    </div>
    <div v-if="isSubmitted && !readonly" class="card-footer">
      <div id="footer-controls" class="container">
        <div class="row">
          <div id="edit-buttons" class="col text-start">
            <button class="btn btn-outline-secondary" data-placement="top" data-toggle="tooltip" title="Edit annotation"
                    type="button" v-on:click="edit()">
              <svg class="bi bi-pencil-square" fill="currentColor" height="16" viewBox="0 0 16 16"
                   width="16" xmlns="http://www.w3.org/2000/svg">
                <path
                    d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/>
                <path d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z"
                      fill-rule="evenodd"/>
              </svg>
              <span class="visually-hidden">Edit</span>
            </button>
            <button class="btn btn-outline-secondary" data-placement="top" data-toggle="tooltip" title="Delete annotation"
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
/* Annotation.vue - annotation elements

This component holds the current data of each annotation and handles the annotation functionality itself

Author: Nils Dycke (dycke@ukp...)
Source: -
*/
import Tags from "bootstrap5-tags/tags.js";
import {mapActions, mapGetters} from 'vuex';
import {Comment} from "../../../data/comment.js";

export default {
  name: "Annotation",
  props: ["annoData", "config", "readonly"],
  data: function () {
    return {
      input_required: false
    }
  },
  mounted() {
    const formElement = `#annotationTags-${this.annoData.id}`;
    Tags.init(formElement);

    const autoSubmit = (this.annoData.tags.length === 1 && this.annoData.tags[0] === "Highlight");

    if (this.annoData.state === "SUBMITTED") {
      this.toSubmitState();
    } else {
      this.toEditState();

      //focus (delay necessary, because the sidepane first needs to update the scrollable area before focusing)
      setTimeout(() => this.$emit("focus", this.annoData.id), 100);
    }

    if(autoSubmit){
      this.submit();
    }

    if(!this.isSubmitted){
        this.input_required = true;
        setTimeout(() => this.input_required = false, 800);
    }

    this.eventBus.on("createdAnnotation", m => {
      if(!this.isSubmitted){
        this.submit();
      }
    });
  },
  unmounted() {
  },
  watch: {
    isSubmitted(newVal, oldVal) {
      if (newVal) {
        this.toSubmitState();
      } else {
        this.toEditState();
      }
    },
  },
  computed: {
    isPageNote() {
      return this.annoData.text === null || this.annoData.text.length === 0;
    },
    assignableTags() {
      let activeTagset = this.$store.getters["settings/getValue"]("tagsSet.selected");
      if(activeTagset === null || activeTagset === undefined){
        activeTagset = this.$store.getters["settings/getValue"]("tagsSet.default");
      }

      if(activeTagset === null || activeTagset === undefined){
        return [];
      } else {
        return this.$store.getters["tag/getTags"](parseInt(activeTagset)); //todo for some reason getValueInt errors
      }
    },
    nonActiveTags() {
      if(this.assignableTags === undefined || this.assignableTags === null){
        return [];
      }

      const nonActiveTags = this.annoTags.filter(t => !this.assignableTags.map(x => x.name).includes(t));
      const allTags = this.$store.getters["tag/getAllTags"];

      console.log("alltags", allTags);
      console.log("nonActiveTags", nonActiveTags);

      return nonActiveTags.map(t => {
        const matched = allTags.find(a => a.description === t);
        if(!matched){
          return {name: t, colorCode: "primary", description: t}
        } else {
          return matched;
        }
      });
    },
    isSubmitted: function () {
      return this.annoData.state === "SUBMITTED";
    },
    annoComment: {
      get() {
        return this.annoData.hasComment() ? this.annoData.comment.text : "";
      },
      set(value) {
        if (!this.annoData.hasComment()) {
          this.annoData.comment = new Comment(null, value, this.annoData.id, null, this.$store.getters["auth/getUser"].id);
        } else {
          this.annoData.comment.text = value;
        }
      }
    },
    annoTags: {
      get() {
        return this.annoData.tags.sort();
      },
      set(value) {
        this.annoData.tags = value.sort();
      }
    },
    truncatedText: function () {
      const thresh = 150;
      const len = this.annoData.text.length;

      if (len > thresh) {
        const overflow = len - thresh - " ... ".length;
        const center = Math.floor(len / 2);
        const cutoff_l = center - Math.floor(overflow / 2);
        const cutoff_r = center + Math.floor(overflow / 2) + overflow % 2;

        return this.annoData.text.slice(0, cutoff_l) + " ... " + this.annoData.text.slice(cutoff_r);
      } else {
        return this.annoData.text;
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
    getTagInput() {
      return document.querySelector(`div[uid=tags${this.annoData.id}] div input`);
    },
    toSubmitState() {
      const inElem = this.getTagInput();
      if(inElem){
        inElem.disabled = true;

         if (this.annoData.tags == null || this.annoData.tags.length === 0) {
          inElem.placeholder = "No Tags";
        } else {
          inElem.placeholder = "";
        }
        inElem.dispatchEvent(new KeyboardEvent("keydown", {"keyCode": 13}));
      }
    },
    toEditState() {
      const inElem = this.getTagInput();
      inElem.disabled = false;
      inElem.placeholder = "Add tag...";
    },
    submit() {
      this.annoData.state = "SUBMITTED";

      this.toSubmitState();

      this.$socket.emit('updateAnnotation', {
        "annotation_id": this.annoData.id,
        "newComment": this.annoData.comment,
        "newTags": this.annoData.tags,
      });
    },
    edit() {
      this.annoData.state = "EDIT";

      this.toEditState();
    },
    remove() {
      this.annoData.state = "DELETED";
      this.deleteAnnotation(this.annoData);
      this.$socket.emit('deleteAnnotation', {
        "id": this.annoData.id
      });
    },
    respond() {
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