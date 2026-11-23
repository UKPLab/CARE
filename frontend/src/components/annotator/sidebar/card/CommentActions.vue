<template>
  <div
    v-if="editing"
    class="ms-auto d-flex justify-content-end align-items-center gap-2"
    @click.stop
  >
    <BasicButton
      class="btn btn-link btn-sm"
      :text="$t('common.cancel')"
      :title="$t('common.cancel')"
      aria-keyshortcuts="Escape"
      @click="$emit('cancel')"
    />
    <BasicButton
      class="btn btn-primary btn-sm"
      :text="$t('common.save')"
      :title="saveTitle"
      aria-keyshortcuts="Meta+Enter Control+Enter"
      @click="$emit('save')"
    />
  </div>
  <div
    v-else
    class="ms-auto anno-card-bar"
  >
    <slot name="start"/>
    <div
      v-if="settingResponse && !readOnly"
      @click.stop
    >
      <BasicButton
        class="btn btn-sm btn-link"
        icon="reply"
        :text="$t('common.reply')"
        @click="reply"
      />
    </div>
    <CardActions
      ref="menu"
      :placement="placement"
    >
      <slot name="before-vote"/>
      <VoteButtons :comment="comment"/>
      <SidebarButton
        v-if="isOwner && !readOnly"
        :loading="false"
        :props="statsProps"
        icon="pencil-square"
        :title="editTitle || $t('common.edit')"
        @click="$emit('edit')"
      />
      <slot name="before-delete"/>
      <SidebarButton
        v-if="(isOwner || canDeleteOthers) && !readOnly"
        class="anno-action-danger"
        :loading="false"
        :props="statsProps"
        icon="trash3"
        :title="$t('common.delete')"
        @click="$emit('delete')"
      />
    </CardActions>
  </div>
</template>

<script>
import SidebarButton from "./Button.vue";
import VoteButtons from "./VoteButtons.vue";
import CardActions from "./CardActions.vue";
import BasicButton from "@/basic/Button.vue";
import { resolveApiMessage } from "@/assets/utils";

/**
 * Action row of a comment in the annotation sidebar
 *
 * While the comment is edited it offers Save and Cancel; otherwise Reply next to the "..." menu with votes,
 * Edit and Delete. Replying creates the reply comment here; the card decides what Save, Cancel, Edit and Delete do.
 * Slots: start (before Reply), before-vote and before-delete (inside the menu).
 *
 * @author Nils Dycke, Dennis Zyska
 */
export default {
  name: "CommentActions",
  components: {SidebarButton, VoteButtons, CardActions, BasicButton},
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
    // Title of the Edit action; defaults to "Edit"
    editTitle: {type: String, default: null},
    // Side the "..." menu opens on: "top" or "bottom"
    placement: {type: String, default: "top"},
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
    /** Moves keyboard focus to the "..." menu button that holds Edit, e.g. when editing ends. */
    focusTrigger() {
      this.$refs.menu?.focusTrigger();
    },
  },
};
</script>

<style scoped>
.anno-card-bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: .25rem;
}
</style>
