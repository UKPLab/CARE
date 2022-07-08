<template>
  <b-card>
    <div class="card-header">
      <a id="user_info">User: {{ annoData.user }}</a>
    </div>
    <div class="card-body">
      <div class="d-grid gap-2">
        <blockquote v-if="annoData.comment.length > 0"
                    class="blockquote card-text"
                    id="comment"
                    v-on:click="scrollTo(annoData.id)">
          {{ truncatedComment }}
        </blockquote>
        <div v-else class="blockquote card-text" id="comment">
          <span> - </span>
        </div>
        <div id="text" v-if="!isSubmitted">
          <textarea id="annoText"
                    class="form-control"
                    placeholder="Enter text..."
                    v-model="annoText">
          </textarea>
        </div>
        <div id="text" v-else-if="annoData.text != null && annoData.text.length > 0" class="card-text">
          {{ annoData.text }}
        </div>
        <div id="tags" v-bind:uid="'tags'+annoData.id" v-bind:disabled="isSubmitted">
            <select class="form-select"
                    v-bind:id="'annotationTags-'+annoData.id"
                    name="tags_new[]"
                    multiple data-allow-new="true"
                    allowClear="true"
                    placeholder="Add tag..."
                    v-bind:disabled="isSubmitted"
                    v-model="annoTags">
              <option selected disabled hidden value="">Choose a tag...</option>
              <option value="strength" data-badge-style="success">Strength</option>
              <option value="weakness" data-badge-style="danger">Weakness</option>
              <option value="summary" data-badge-style="warning">Summary</option>
              <option value="question" data-badge-style="info">Question</option>
            </select>
            <div class="invalid-feedback">Please select a valid tag.</div>
        </div>
        <div class="btn-group btn-group-sm" role="group" v-if="!isSubmitted">
          <button class="btn btn-primary" type="button" v-on:click="submit()">Submit</button>
          <button class="btn btn-danger" type="button" v-on:click="remove()">Discard</button>
        </div>
      </div>
    </div>
    <div class="card-footer" v-if="isSubmitted">
      <div class="container" id="footer-controls">
        <div class="row">
          <div class="col text-start" id="edit-buttons">
            <button type="button" class="btn btn-outline-secondary" data-toggle="tooltip" data-placement="top" title="Edit annotation" v-on:click="edit()">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pencil-square" viewBox="0 0 16 16">
                <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z"/>
                <path fill-rule="evenodd" d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z"/>
              </svg>
              <span class="visually-hidden">Edit</span>
            </button>
            <button type="button" class="btn btn-outline-secondary" data-toggle="tooltip" data-placement="top" title="Delete annotation" v-on:click="remove()">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash3" viewBox="0 0 16 16">
                <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5ZM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.506a.58.58 0 0 0-.01 0H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1h-.995a.59.59 0 0 0-.01 0H11Zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5h9.916Zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47ZM8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5Z"/>
              </svg>
              <span class="visually-hidden">Delete</span>
            </button>
          </div>
          <div class="col text-end">
            <button type="button" class="btn btn-outline-secondary" data-toggle="tooltip" data-placement="top" title="Respond to annotation">
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-90deg-left" viewBox="0 0 16 16">
                <path fill-rule="evenodd" d="M1.146 4.854a.5.5 0 0 1 0-.708l4-4a.5.5 0 1 1 .708.708L2.707 4H12.5A2.5 2.5 0 0 1 15 6.5v8a.5.5 0 0 1-1 0v-8A1.5 1.5 0 0 0 12.5 5H2.707l3.147 3.146a.5.5 0 1 1-.708.708l-4-4z"/>
             </svg>
             <span class="visually-hidden">Respond</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </b-card>
</template>

<script>
import Tags from "bootstrap5-tags/tags.js";
import { mapActions } from 'vuex';

export default {
  name: "Annotation",
  props: ["annoData", "config", "scrollTo"],
  data: function() {
    return {
      state:"CREATED"
    }
  },
  mounted() {
    const formElement = `#annotationTags-${this.annoData.id}`;
    Tags.init(formElement);
  },
  watch: {
    state(newS, oldS) {
      console.log("Annotation " + this.annoData.id + " changing state:");
      console.log("State change from " + oldS + " to " + newS);
    }
  },
  unmounted() {
    console.log("Unmounting " + this.annoData.id);
  },
  computed: {
    isSubmitted: function(){
      return this.state === "SUBMITTED";
    },
    annoText: {
      get() {
        return this.annoData.text;
      },
      set(value) {
        this.annoData.text = value;
      }
    },
    annoTags: {
      get() {
        return this.annoData.tags;
      },
      set(value) {
        this.annoData.tags=value;
      }
    },
    truncatedComment: function() {
      const thresh = 250;
      const len = this.annoData.comment.length;

      if(len > thresh){
        const overflow = len - thresh - " ... ".length;
        const center = Math.floor(len / 2);
        const cutoff_l = center - Math.floor(overflow / 2);
        const cutoff_r = center + Math.floor(overflow / 2) + overflow % 2;

        return this.annoData.comment.slice(0, cutoff_l) + " ... " + this.annoData.comment.slice(cutoff_r);
      } else {
        console.log("No need to truncate");
        return this.annoData.comment;
      }
    }
  },
  methods: {
     ...mapActions({
       deleteAnnotation: "anno/deleteAnnotation"
     }),
     getTagInput() {
      return document.querySelector(`div[uid=tags${this.annoData.id}] div input`);
     },
    submit() {
      this.state = "SUBMITTED";

      const inElem = this.getTagInput();
      inElem.disabled = true;
      if(this.annoData.tags == null || this.annoData.tags.length === 0){
        inElem.placeholder = "No Tags";
      } else {
        inElem.placeholder = "";
      }
      inElem.dispatchEvent(new KeyboardEvent("keydown", {"keyCode": 13}));
    },
    edit() {
      this.state = "EDIT";

      const inElem = this.getTagInput();
      inElem.disabled = false;
      inElem.placeholder = "Add tag...";
    },
    remove() {
      this.state = "DELETED";
      this.deleteAnnotation(this.annoData);
    },
    respond() {
      console.log("A user tries to respond");
    },
  }
}
</script>

<style>
.card-header {
  text-align: right;
  font-size: smaller;
  color: #929292;
}
.card-body {
  padding-left: 8px;
  padding-right: 8px;
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
}
#comment {
  color: #4d4d4d;
  font-style: italic;
  font-size: small;
  cursor:pointer;
  display:block;
}
#comment:hover {
  color: #000000;
}
.card-footer {
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
</style>