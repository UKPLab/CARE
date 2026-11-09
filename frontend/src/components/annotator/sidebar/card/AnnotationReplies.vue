<template>
  <div
      v-if="showReplies"
      class="anno-replies"
  >
    <div
        v-for="c in displayedComments"
        :key="c.id"
        class="anno-reply"
    >
      <Comment
          :comment-id="c.id"
          :level="1"
      />
    </div>
    <div
      v-if="showExtenderButton || numChildComments > defaultNumComments"
      class="anno-reply-more"
    >
      <BasicButton
      v-if="showExtenderButton"
      ref="showMore"
      class="btn btn-sm btn-link"
      :text="$t('common.showMore')"
      @click="$emit('update:maxComments', maxComments + 5)"
      />
      <BasicButton
      v-if="!showExtenderButton && numChildComments > defaultNumComments"
      class="btn btn-sm btn-link"
      :text="$t('common.showLess')"
      @click="showLess"
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
    /**
     * Shows fewer replies; the Show less button disappears, so focus moves to Show more.
     * @returns {void}
     */
    showLess() {
      this.$emit('update:maxComments', this.defaultNumComments);
      this.$nextTick(() => {
        if (this.$refs.showMore) this.$refs.showMore.$el.focus();
      });
    },
  }
}
</script>

<style scoped>
.anno-replies {
  display: flex;
  flex-direction: column;
  gap: .65rem;
  margin-top: .35rem;
}

.anno-reply {
  border: 0;
  border-radius: 8px;
  background: color-mix(in srgb, var(--care-primary) 8%, transparent);
  padding: .55rem .7rem;
}

.anno-reply-more {
  display: flex;
  justify-content: flex-end;
  gap: .35rem;
}
</style>
