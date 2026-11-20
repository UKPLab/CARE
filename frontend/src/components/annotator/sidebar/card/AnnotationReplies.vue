<template>
  <div v-if="showReplies">
    <span
        v-for="c in displayedComments"
        :key="c.id"
    >
      <slot :reply="c"/>
    </span>
    <div class="btn-group">
      <BasicButton
      v-if="showExtenderButton"
      ref="showMore"
      class="btn btn-light btn-sm"
      :text="$t('common.showMore')"
      @click="$emit('update:maxComments', maxComments + 5)"
      />
      <BasicButton
      v-if="!showExtenderButton && numChildComments > defaultNumComments"
      class="btn btn-light btn-sm"
      :text="$t('common.showLess')"
      @click="showLess"
      />
      <BasicButton
      v-if="showHideButton"
      class="btn btn-light btn-sm"
      :text="$t('common.hideReplies')"
      @click="$emit('update:maxComments', defaultNumComments); $emit('update:showReplies', !showReplies)"
      />
    </div>

  </div>
</template>

<script>
import BasicButton from "@/basic/Button.vue";

/** Reply thread list
 *
 * Displays the replies to a comment, oldest first, with show more / show less / hide controls. Used for the
 * replies of an annotation card (level 1) and, recursively, for the replies to a reply (level 2 and deeper).
 * Each reply is rendered through the default slot ({reply}), so the thread does not depend on the comment
 * component that renders it. showReplies/maxComments stay with the parent, which also has controls for them;
 * this component emits update:showReplies/update:maxComments and exposes expandForNewReply().
 *
 * @author Nils Dycke, Dennis Zyska
 *
 */
export default {
  name: "AnnotationReplies",
  components: {BasicButton},
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
    // Level of the listed replies: 1 for the replies of an annotation card
    'level': {
      type: Number,
      default: 1,
    },
  },
  emits: ['update:showReplies', 'update:maxComments'],
  computed: {
    defaultNumComments() {
      const key = this.level > 1 ? "levelOneUp" : "levelZero";
      return parseInt(this.$store.getters["settings/getValue"]("annotator.comments.defaultNumsShown." + key));
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
    // Replies of a card can always be hidden; deeper threads only once more than the default are shown
    showHideButton() {
      return this.level > 1 ? this.maxComments > this.defaultNumComments : this.numChildComments > 0;
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
