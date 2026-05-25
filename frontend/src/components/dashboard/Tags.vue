<template>
  <BasicCard :title="$t('tags.title')">
    <template #headerElements>
      <BasicButton
        class="btn-primary btn-sm"
        :title="$t('tags.addNewTagSet')"
        icon="plus"
        @click="$refs.tagSetModal.open(0)"
      />
    </template>
    <template #body>
      <BasicTable
        :columns="columns"
        :data="tagSets"
        :options="options"
        :buttons="buttons"
        :max-table-height="'65vh'"
        @action="action"
      />
    </template>
  </BasicCard>
  <TagSetModal
    ref="tagSetModal"
  />
  <ConfirmModal ref="confirm"/>
</template>

<script>
/**
 * Tags list component
 *
 * This dashboard component provides a view to update/edit and add tags
 *
 * @author Dennis Zyska
 */
import BasicTable from "@/basic/Table.vue";
import BasicCard from "@/basic/dashboard/card/Card.vue";
import BasicButton from "@/basic/Button.vue";
import TagSetModal from "./coordinator/TagSet.vue";

import {mapGetters} from "vuex";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";
import { resolveApiMessage } from "@/assets/utils";

export default {
  name: "DashboardTags",
  subscribeTable: ["tag_set", "tag"],
  components: {ConfirmModal, BasicTable, BasicCard, BasicButton, TagSetModal},
  props: {
    'admin': {
      type: Boolean,
      required: false,
      default: false
    },
  },
  data() {
    return {
      options: {
        striped: true,
        hover: true,
        bordered: false,
        borderless: false,
        small: false,
        pagination: 10,
      },
    }
  },
  computed: {
    ...mapGetters({
      userId: 'auth/getUserId',
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
      const buttons = [
        {
          icon: "clipboard",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-secondary": true,
            }
          },
          title: this.$t('tags.copyTagSet'),
          action: "copyTagSet",
          stats: {
            tagSetId: "id",
          }
        },
        {
          icon: "pencil",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-dark": true,
            }
          },
          filter: [
            {key: "userId", value: this.userId},
          ],
          title: this.$t('tags.editTagSet'),
          action: "editTagSet",
          stats: {
            tagSetId: "id",
          }
        },
        {
          icon: "trash",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-dark": true,
            }
          },
          filter: [
            {key: "userId", value: this.userId},
          ],
          title: this.$t('tags.deleteTagSet'),
          action: "deleteTagSet",
          stats: {
            tagSetId: "id",
          }
        },
        {
          icon: "share",
          options: {
            iconOnly: true,
            specifiers: {
              "btn-outline-dark": true,
            }
          },
          filter: [
            {key: "public", value: false},
            {key: "userId", value: this.userId},
          ],
          title: this.$t('tags.shareTagSet'),
          action: "publishTagSet",
          stats: {
            tagSetId: "id",
          }
        }
      ];
      return buttons;
    },
    tagSets() {
      return this.$store.getters["table/tag_set/getAll"]
        .filter(d => d.projectId === this.projectId) // Filter by selected project
        .map(d => {
          let newD = {...d};
          newD.published = {
            text: newD.public || newD.userId === null ? this.$t('common.yes') : this.$t('common.no'),
            class: newD.public || newD.userId === null ? "bg-success" : "bg-danger",
          };
          newD.user = {
            text: newD.creator_name
          };
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
      }
    },
    deleteTagSet(row) {
      this.$refs.confirm.open(
        this.$t('tags.messages.deleteTitle'),
        this.$t('tags.messages.deleteConfirm'),
        "",
        (val) => {
          if (val) {
            this.$socket.emit("appDataUpdate", {
              table: "tag_set",
              data: {
                id: row.id,
                deleted: true
              }
            }, (result) => {
              if (result.success) {
                this.eventBus.emit('toast', {
                  title: this.$t('tags.messages.tagSetDeleted'),
                  message: this.$t('tags.messages.tagSetDeletedMessage'),
                  variant: "success"
                });
              } else {
                this.eventBus.emit('toast', {
                  title: this.$t('errors.tags.tagSetDeleteFailed'),
                  message: resolveApiMessage(result),
                  variant: "danger"
                });
              }
            });
          }
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