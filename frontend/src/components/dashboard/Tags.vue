<template>
  <BasicCard title="Tag Sets">
    <template #headerElements>
      <BasicButton
        class="btn-primary btn-sm"
        title="Add new tag set"
        @click="$refs.tagSetModal.open(0)"
      />
    </template>
    <template #body>
      <BasicTable
        :columns="columns"
        :data="tagSets"
        :options="options"
        :buttons="buttons"
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
import BasicCard from "@/components/dashboard/card/Card.vue";
import BasicButton from "@/basic/Button.vue";
import TagSetModal from "./coordinator/TagSet.vue";

import {mapGetters} from "vuex";
import ConfirmModal from "@/basic/modal/ConfirmModal.vue";

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
      columns: [
        {name: "", key: "select", type: "icon-selector"},
        {name: "Name", key: "name"},
        {name: "Created At", key: "createdAt", type: "datetime"},
        {name: "Last Change", key: "updatedAt", type: "datetime"},
        {name: "Public", key: "published", type: "badge"},
        {name: "User", key: "user", type: "badge"},
        {name: "Tags", key: "tags", type: "badge"},
      ]
    }
  },
  computed: {
    ...mapGetters({
      userId: 'auth/getUserId',
      isAdmin: 'auth/isAdmin',
    }),
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
          title: "Copy tag set",
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
          title: "Edit tag set",
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
          title: "Delete tag set",
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
          title: "Share tag set",
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
            text: newD.public || newD.userId === null ? "Yes" : "No",
            class: newD.public || newD.userId === null ? "bg-success" : "bg-danger",
          };
          newD.user = {
            text: newD.creator_name
          };
          newD.select = {
            icon: (newD.id === this.selectedTagset) ? "star-fill" : "star",
            title: "Select tag set as default",
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
        "Delete Tagset",
        "Do you really want to delete the Tagset?",
        "",
        function (val) {
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
                  title: "TagSet deleted",
                  message: "The TagSet was successfully deleted",
                  variant: "success"
                });
              } else {
                this.eventBus.emit('toast', {
                  title: "TagSet delete failed",
                  message: result.message,
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
        "Publish Tagset",
        "Do you really want to publish the tagset? <br><br>" +
        "      <strong>Note:</strong> Once you published it, you can't unpublish the tagset! If you want to unpublish it, you have to delete it\n" +
        "      and create a new one.\n" +
        "      If published the tagset will be available for all users.",
        "",
        function (val) {
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
                  title: "TagSet published",
                  message: "The TagSet was successfully published",
                  variant: "success"
                });
              } else {
                this.eventBus.emit('toast', {
                  title: "TagSet publishing failed",
                  message: result.message,
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
          title: "Tag set is empty",
          message: "You can not select an empty tag set as default.",
        });
      }
    },
  },
}
</script>

<style scoped>

</style>