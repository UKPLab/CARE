<template>
  <Modal ref="editorAssign" lg items:items selected:editor selectStyle:selectStyle>
    <template v-slot:title>Select a user to assign</template>
    <template v-slot:body>
      <ul class="list-group">
        <li v-for="e in items()" class="list-group-item list-group-item-action" @click="set_editor(e.id)" v-bind:class="selectStyle(e.id)">
          {{e.user_name}} (ID: {{e.id}})
        </li>
      </ul>

    </template>
    <template v-slot:footer>
      <button class="btn btn-secondary" type="button" @click="cancel">Abort</button>
       <button class="btn btn-success me-2" type="button" @click="submit">Submit</button>
    </template>
  </Modal>
</template>

<script>
import Modal from "./Modal.vue";
import {mapGetters} from "vuex";
export default {
  name: "EditorSelect",
  components: {Modal},
  props: {
  },
  data() {
    return {
      review: null,
      editor: null,
    }
  },
  mounted() {
    this.$socket.emit("getAllUserData");
  },
  methods: {
     ...mapGetters({items: 'admin/getUsers'}),

    open(review) {
      this.review = review;
      if(this.review.decisionBy !== null){
        this.editor = this.review.decisionBy;
      }
      this.$refs.editorAssign.openModal();
    },
    cancel() {
      this.$refs.editorAssign.closeModal();
    },
    set_editor(editor) {
      this.editor = editor;
    },
    submit() {
      this.$refs.editorAssign.waiting = true;
      this.sockets.subscribe("editorAssigned", (data) => {
        this.$refs.editorAssign.closeModal();
        this.sockets.unsubscribe('editorAssigned');

        this.editor = null;

        if (data.success) {
          //todo inefficient reloading for now
          this.$socket.emit("getAllReviews");
          this.$socket.emit("getReviews");

          this.eventBus.emit('toast', {title:"Editor Assignment", message:"Successful assigned the editor!", variant: "success"});
          this.$router.push("/");
        } else {
          this.eventBus.emit('toast', {title:"Editor Assignment", message:"Error during assignment of the editor! Please try it again!", variant: "danger"});
        }
      });

      this.$socket.emit('editorAssign',
          {
            "editor_id": this.editor,
            "review_id": this.review.hash
          });
    },
    selectStyle(eid) {
       if(eid === this.editor){
         return "active"
       } else {
         return ""
       }
    }
  }
}
</script>

<style scoped>

</style>