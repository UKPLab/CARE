<template>
  <DashboardListPage
    :title="$t('tags.title')"
    :empty-action="emptyAction"
    :columns="columns"
    :data="tagSets"
    :buttons="buttons"
    :table-options="options"
    @action="action"
  >
    <template #headerActions>
      <HeaderActions :actions="headerActions">
        <BasicButton
          class="btn-primary btn-sm"
          :title="$t('tags.addNewTagSet')"
          icon="plus"
          @click="$refs.tagSetModal.open(0)"
        />
      </HeaderActions>
    </template>
  </DashboardListPage>
  <TagSetModal
    ref="tagSetModal"
  />
  <ConfirmModal ref="confirm"/>
  <ExportFormatModal ref="exportFormatModal" :title="$t('modals.importExport.wiring.tags.exportTitle')" />
  <ImportFormatModal ref="importFormatModal" :title="$t('modals.importExport.wiring.tags.importTitle')" />
</template>

<script>
/**
 * Tags list component
 *
 * This dashboard component provides a view to update/edit and add tags
 *
 * @author Dennis Zyska
 */
import BasicButton from "@/basic/Button.vue";
import TagSetModal from "./coordinator/TagSet.vue";
import ExportFormatModal from "@/basic/modal/ExportFormatModal.vue";
import ImportFormatModal from "@/basic/modal/ImportFormatModal.vue";

import {mapGetters} from "vuex";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import DashboardListPage from "@/basic/dashboard/ListPage.vue";
import HeaderActions from "@/basic/dashboard/HeaderActions.vue";
import {dashboardRowAction, DASHBOARD_BADGES, confirmSoftDelete} from "@/basic/dashboard/actions.js";
import {DEFAULT_DASHBOARD_TABLE_OPTIONS} from "@/basic/dashboard/constants.js";
import { resolveApiMessage } from "@/assets/utils";

export default {
  name: "DashboardTags",
  subscribeTable: ["tag_set", "tag"],
  components: {ConfirmModal, DashboardListPage, HeaderActions, BasicButton, TagSetModal, ExportFormatModal, ImportFormatModal},
  props: {
    'admin': {
      type: Boolean,
      required: false,
      default: false
    },
  },
  data() {
    return {
      options: {...DEFAULT_DASHBOARD_TABLE_OPTIONS},
    }
  },
  computed: {
    /** Secondary header buttons; collapse into "..." when the header is too narrow. */
    headerActions() {
      return [
        {key: "import", text: this.$t('common.import'), icon: "upload", onClick: () => this.$refs.importFormatModal.open('tag_set')},
        {key: "exportAll", text: this.$t('common.exportAll'), title: this.$t('modals.importExport.wiring.tags.exportAllTooltip'), icon: "download", onClick: () => this.$refs.exportFormatModal.open(null, 'tag_set', 'tag', null, { key: 'tags' })},
      ];
    },
    /** Same as the header create button; offered while the table is empty. */
    emptyAction() {
      return {
        label: this.$t('tags.addNewTagSet'),
        icon: "plus-lg",
        handler: () => this.$refs.tagSetModal.open(0),
      };
    },
    ...mapGetters({
      userId: 'auth/getUserId',
      username: 'auth/getUsername',
      isAdmin: 'auth/isAdmin',
    }),
    columns() {
      return [
        {name: "", key: "select", type: "icon-selector"},
        {name: this.$t('common.name'), key: "name"},
        {name: this.$t('common.createdAt'), key: "createdAt", type: "datetime"},
        {name: this.$t('tags.columns.lastChange'), key: "updatedAt", type: "datetime"},
        {name: this.$t('common.public'), key: "published", type: "badge"},
        {name: this.$t('tags.columns.user'), key: "user", type: "badge"},
        {name: this.$t('tags.columns.tags'), key: "tags", type: "badge"},
      ];
    },
    buttons() {
      return [
        dashboardRowAction("copy", {
          title: this.$t('tags.copyTagSet'),
          action: "copyTagSet",
          stats: {
            tagSetId: "id",
          }
        }),
        dashboardRowAction("edit", {
          filter: [
            {key: "userId", value: this.userId},
          ],
          title: this.$t('tags.editTagSet'),
          action: "editTagSet",
          stats: {
            tagSetId: "id",
          }
        }),
        dashboardRowAction("delete", {
          filter: [
            {key: "userId", value: this.userId},
          ],
          title: this.$t('tags.deleteTagSet'),
          action: "deleteTagSet",
          stats: {
            tagSetId: "id",
          }
        }),
        dashboardRowAction("share", {
          filter: [
            {key: "public", value: false},
            {key: "userId", value: this.userId},
          ],
          filterMode: "and",
          title: this.$t('tags.shareTagSet'),
          action: "publishTagSet",
          stats: {
            tagSetId: "id",
          }
        }),
        dashboardRowAction("download", {
          title: this.$t('tags.exportTagSet'),
          action: "exportTagSet",
        }),
      ];
    },
    tagSets() {
      return this.$store.getters["table/tag_set/getAll"]
        .filter(d => d.projectId === this.projectId) // Filter by selected project
        .map(d => {
          let newD = {...d};
          newD.published = {
            text: newD.public || newD.userId === null ? this.$t('common.yes') : this.$t('common.no'),
            class: DASHBOARD_BADGES.publicPrivate[!!(newD.public || newD.userId === null)],
          };
          const owner = this.tagSetOwner(newD);
          newD.user = owner
            ? { text: owner, class: "bg-secondary" }
            : "";
          newD.select = {
            icon: (newD.id === this.selectedTagset) ? "star-fill" : "star",
            title: this.$t('tags.selectAsDefault'),
            action: "defaultTagSet",
            selected: newD.id === this.selectedTagset,
          },
            newD.tags = {
              class: "bg-primary",
              tooltip: this.$store.getters["table/tag/getFiltered"](tag => tag.tagSetId === newD.id).map(e => e.name).join('<br>'),
              text: this.$store.getters["table/tag/getFiltered"](tag => tag.tagSetId === newD.id).length
            };
          return newD;
        }
      );
    },
    projectId() {
      return this.$store.getters["settings/getValueAsInt"]("projects.default");
    },
    tags() {
      return this.$store.getters["table/tag/getAll"];
    },
    selectedTagset() {
      return this.$store.getters['settings/getValueAsInt']("tags.tagSet.default");
    },
  },
  methods: {
    /**
     * Owner shown in the User column. No creator_name stays blank.
     * A live row can arrive before that name, so a set you just added uses your name.
     */
    tagSetOwner(row) {
      if (row.creator_name) return row.creator_name;
      if (row.userId != null && row.userId === this.userId) return this.username;
      return "";
    },
    action(data) {
      switch (data.action) {
        case "copyTagSet":
          this.$refs.tagSetModal.copy(data.params.id);
          break;
        case "editTagSet":
          this.$refs.tagSetModal.open(data.params.id);
          break;
        case "deleteTagSet":
          this.deleteTagSet(data.params);
          break;
        case "publishTagSet":
          this.publishTagset(data.params);
          break;
        case "defaultTagSet":
          this.selectAsDefault(data.params.id);
          break;
        case "exportTagSet":
          this.$refs.exportFormatModal.open(data.params.id, "tag_set", "tag", null, { key: "tags" });
          break;
      }
    },
    deleteTagSet(row) {
      confirmSoftDelete(
        {
          confirmRef: this.$refs.confirm,
          socket: this.$socket,
          eventBus: this.eventBus,
        },
        {
          table: "tag_set",
          id: row.id,
          title: this.$t('tags.messages.deleteTitle'),
          message: this.$t('tags.messages.deleteConfirm'),
          failTitle: this.$t('errors.tags.tagSetDeleteFailed'),
          onSuccess: () => {
            this.eventBus.emit('toast', {
              title: this.$t('tags.messages.tagSetDeleted'),
              message: this.$t('tags.messages.tagSetDeletedMessage'),
              variant: "success"
            });
          },
        }
      );
    },
    publishTagset(row) {
      this.$refs.confirm.open(
        this.$t('tags.messages.publishTitle'),
        this.$t('tags.messages.publishConfirm'),
        "",
        (val) => {
          if (val) {
            this.$socket.emit("appDataUpdate", {
              table: "tag_set",
              data: {
                id: row.id,
                public: true
              }
            }, (result) => {
              if (result.success) {
                this.eventBus.emit('toast', {
                  title: this.$t('tags.messages.tagSetPublished'),
                  message: this.$t('tags.messages.tagSetPublishedMessage'),
                  variant: "success"
                });
              } else {
                this.eventBus.emit('toast', {
                  title: this.$t('errors.tags.tagSetPublishFailed'),
                  message: resolveApiMessage(result),
                  variant: "danger"
                });
              }
            });
          }
        }
      );
    },
    selectAsDefault(tagSetId) {
      const length = this.$store.getters["table/tag/getFiltered"](tag => tag.tagSetId === tagSetId).length;
      if (length > 0) {
        this.$socket.emit("appSettingSet", {key: "tags.tagSet.default", value: tagSetId});
      } else {
        this.eventBus.emit('toast', {
          variant: "danger",
          title: this.$t('errors.tags.tagSetEmpty'),
          message: this.$t('errors.tags.tagSetEmptyMessage'),
        });
      }
    },
  },
}
</script>

<style scoped>

</style>