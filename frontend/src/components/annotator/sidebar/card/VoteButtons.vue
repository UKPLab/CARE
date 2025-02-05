<template>
  <SidebarButton
    v-if="voteEnabled && (upVotes.length >= 1 || comment.userId !== userId)"
    :loading="false"
    :props="$props"
    title="Helpful"
    :disabled="comment.userId === userId"
    :badge="(upVotes.length >= 1) ? upVotes.length : false"
    :icon="(myVoteValue === 1) ? 'hand-thumbs-up-fill' : 'hand-thumbs-up'"
    @click="vote(1)"
  />
  <SidebarButton
    v-if="voteEnabled && !voteOnlyUpvote && comment.userId !== userId"
    :loading="false"
    :props="$props"
    title="Not helpful"
    :icon="(myVoteValue === -1) ? 'hand-thumbs-down-fill' : 'hand-thumbs-down'"
    @click="vote(-1)"/>
</template>

<script>
import SidebarButton from "./Button.vue"

/**
 * Vote buttons for the sidebar
 **
 * @author Dennis Zyska
 */
export default {
  name: "VoteButtons",
  components: {
    SidebarButton,
  },
  props: {
    comment: {
      type: Object,
      required: true,
    },
  },
  computed: {
    commentId() {
      return this.comment.id;
    },
    userId() {
      return this.$store.getters["auth/getUserId"];
    },
    voteEnabled() {
      return this.$store.getters["settings/getValue"]('annotator.comments.votes.enabled') === "true";
    },
    voteOnlyUpvote() {
      return this.$store.getters["settings/getValue"]('annotator.comments.votes.onlyUpvote') === "true";
    },
    votes() {
      return this.$store.getters["table/comment_vote/getByKey"]("commentId", this.commentId);
    },
    myVote() {
      return this.votes.find(v => v.userId === this.userId);
    },
    myVoteValue() {
      if (this.myVote) {
        return this.myVote.vote;
      }
      return 0;
    },
    upVotes() {
      // show badge only if there is more than 1 and the one is not myself
      const votes = this.votes.filter(v => v.vote === 1);
      if (votes.length === 1 && votes[0].userId === this.userId) {
        return [];
      } else {
        return votes;
      }
    },
  },
  methods: {
    vote(value) {
      if (this.myVote && this.myVoteValue === value) {
        this.$socket.emit('appDataUpdate', {
          table: "comment_vote",
          data: {
            id: this.myVote.id,
            deleted: true
          },
        });
      } else {
        this.$socket.emit('appDataUpdate', {
          table: "comment_vote",
          data: {
            commentId: this.commentId,
            vote: value,
          },
        });
      }
    }
  }
}
</script>

<style scoped>
.start-85 {
  left: 85% !important;
}
</style>