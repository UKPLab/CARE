<template>
  <div
      v-if="showReplies"
      class="d-grid gap-1 my-2"
  >
    <span
        v-for="c in displayedComments"
        :key="c.id"
    >
      <Comment
          :comment-id="c.id"
          :level="1"
      />
    </span>
    <div class="btn-group">
      <BasicButton
      v-if="showExtenderButton"
      class="btn btn-light btn-sm"
      :text="$t('common.showMore')"
      @click="$emit('update:maxComments', maxComments + 5)"
      />
      <BasicButton
      v-if="!showExtenderButton && numChildComments > defaultNumComments"
      class="btn btn-light btn-sm"
      :text="$t('common.showLess')"
      @click="$emit('update:maxComments', defaultNumComments)"
      />
      <BasicButton
      v-if="maxComments > defaultNumComments"
      class="btn btn-light btn-sm"
      :text="$t('common.hideReplies')"
      @click="$emit('update:maxComments', defaultNumComments); $emit('update:showReplies', !showReplies)"
      />
    </div>

  </div>
</template>

<script>
import Comment from "./Comment.vue";
import BasicButton from "@/basic/Button.vue";

/** Reply thread list
 *
 * Displays the reply thread for a comment with show more / show less / hide controls.
 * Extracted from AnnoCard.vue. showReplies/maxComments remain owned by the parent (the
 * footer's own reply-count toggle button and the summarize flow both need them too), so
 * this component receives them as props and emits update:showReplies/update:maxComments
 * for its own internal controls, plus exposes expandForNewReply() for the parent's reply
 * button wiring.
 *
 * @author Nils Dycke, Dennis Zyska
 *
 */
export default {
  name: "AnnotationReplies",
  components: {Comment, BasicButton},
  props: {
    'commentId': {
      type: Number,
      required: true,
    },
    'showReplies': {
      type: Boolean,
      required: true,
    },
    'maxComments': {
      type: Number,
      required: true,
    },
  },
  emits: ['update:showReplies', 'update:maxComments'],
  computed: {
    defaultNumComments() {
      return parseInt(this.$store.getters["settings/getValue"]("annotator.comments.defaultNumsShown.levelZero"));
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
    numChildComments() {
      if (this.childComments){
        return this.childComments.length;
      }
      return 0;
    },
    displayedComments() {
      return this.childComments.slice(0, this.maxComments);
    },
    showExtenderButton() {
      return this.numChildComments > this.maxComments;
    },
  },
  methods: {
    expandForNewReply() {
      this.$emit('update:maxComments', this.numChildComments + 1);
      this.$emit('update:showReplies', true);
    },
  }
}
</script>
