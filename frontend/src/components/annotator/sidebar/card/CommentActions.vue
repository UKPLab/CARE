<template>
  <div class="ms-auto">
    <div
      v-if="editing"
      class="row"
    >
      <div class="col text-end">
        <SidebarButton
          :loading="false"
          :props="statsProps"
          icon="floppy"
          :title="saveTitle"
          @click="$emit('save')"
        />
        <SidebarButton
          :loading="false"
          :props="statsProps"
          icon="x-square"
          :title="$t('common.cancel')"
          @click="$emit('cancel')"
        />
      </div>
    </div>
    <div
      v-else
      class="row"
    >
      <div class="col text-end">
        <SidebarButton
          v-if="settingResponse && !readOnly"
          :loading="false"
          :props="statsProps"
          icon="reply"
          :title="$t('common.reply')"
          @click="reply"
        />
        <slot name="before-vote"/>
        <VoteButtons :comment="comment"/>
        <SidebarButton
          v-if="isOwner && !readOnly"
          ref="editButton"
          :loading="false"
          :props="statsProps"
          icon="pencil-square"
          :title="$t('common.edit')"
          @click="$emit('edit')"
        />
        <slot name="before-delete"/>
        <SidebarButton
          v-if="(isOwner || canDeleteOthers) && !readOnly"
          :loading="false"
          :props="statsProps"
          icon="trash3"
          :title="$t('common.delete')"
          @click="$emit('delete')"
        />
      </div>
      <slot name="end"/>
    </div>
  </div>
</template>

<script>
import SidebarButton from "./Button.vue";
import VoteButtons from "./VoteButtons.vue";
import { resolveApiMessage } from "@/assets/utils";

/**
 * Action row of a comment in the annotation sidebar
 *
 * While the comment is edited it offers Save and Cancel; otherwise Reply, votes, Edit and Delete.
 * Replying creates the reply comment here; the card decides what Save, Cancel, Edit and Delete do.
 *
 * @author Nils Dycke, Dennis Zyska
 */
export default {
  name: "CommentActions",
  components: {SidebarButton, VoteButtons},
  inject: {
    documentId: {default: null},
    studySessionId: {default: null},
    studyStepId: {default: null},
    readOnly: {default: false},
  },
  props: {
    comment: {type: Object, required: true},
    editing: {type: Boolean, default: false},
    saveTitle: {type: String, required: true},
    // Lets someone delete a comment they did not write, e.g. the bot's answer to their own request
    canDeleteOthers: {type: Boolean, default: false},
    // Props of the card, logged with every button click
    statsProps: {type: Object, default: null},
  },
  emits: ['save', 'cancel', 'edit', 'delete', 'replied'],
  computed: {
    isOwner() {
      return this.comment.userId === this.$store.getters["auth/getUserId"];
    },
    settingResponse() {
      return this.$store.getters["settings/getValue"]('annotator.collab.response') === "true";
    },
    anonymize() {
      const studySession = this.$store.getters["table/study_session/get"](this.studySessionId);
      const study = studySession ? this.$store.getters["table/study/get"](studySession.studyId) : null;
      return study ? study.anonymize : false;
    },
  },
  methods: {
    /** Creates an empty reply to the comment, which opens as a draft in the thread. */
    reply() {
      this.$socket.emit('commentUpdate', {
        "documentId": this.documentId,
        "parentCommentId": this.comment.id,
        "studySessionId": this.studySessionId,
        "studyStepId": this.studyStepId,
        "anonymous": this.anonymize,
      }, (res) => {
        if (!res.success) {
          this.eventBus.emit("toast", {
            title: this.$t('errors.annotator.commentNotUpdated'),
            message: resolveApiMessage(res),
            variant: "danger",
          });
        }
      });
      this.$emit('replied');
    },
    /** Moves keyboard focus to the Edit button, e.g. when editing ends. */
    focusEdit() {
      this.$refs.editButton?.$el.focus();
    },
  },
};
</script>
