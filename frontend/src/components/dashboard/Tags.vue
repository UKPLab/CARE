<template>
  <BasicCard title="Tag Sets">
    <template #headerElements>
      <ButtonHeader
        class="btn-primary"
        title="Add new tag set"
        @click="$refs.tagSetModal.open(0)"
      />
    </template>
    <template #body>
      <BasicTable
        :columns="columns"
        :data="tagSets"
        :options="options"
        @action="action"
      />
    </template>
  </BasicCard>
  <TagSetModal
    ref="tagSetModal"
  />
  <TagSetDeleteModal ref="tagSetDeleteModal"/>
  <TagSetPublishModal ref="tagSetPublishModal"/>
</template>

<script>
/**
 * Tags list component
 *
 * This dashboard component provides a view to update/edit and add tags
 *
 * @author Dennis Zyska
 */
import BasicTable from "@/basic/table/Table.vue";
import BasicCard from "@/basic/Card.vue";
import ButtonHeader from "@/basic/card/ButtonHeader.vue";
import TagSetModal from "./coordinator/TagSet.vue";
import TagSetPublishModal from "./tags/TagSetPublishModal.vue";
import TagSetDeleteModal from "./tags/TagSetDeleteModal.vue";

import {mapGetters} from "vuex";

export default {
  name: "DashboardTags",
  fetchData: ['tag_set', 'tag'],
  components: {BasicTable, BasicCard, ButtonHeader, TagSetModal, TagSetPublishModal, TagSetDeleteModal},
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
        {name: "Manage", key: "manage", type: "button-group"},
      ]
    }
  },
  computed: {
    ...mapGetters({
      userId: 'auth/getUserId',
      isAdmin: 'auth/isAdmin',
    }),
    tagSets() {
      return this.$store.getters["table/tag_set/getAll"].map(d => {
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
          newD.manage = [
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
            },
          ]

          if (newD['userId'] === this.userId || this.isAdmin) {
            newD.manage.push(
              {
                icon: "pencil",
                options: {
                  iconOnly: true,
                  specifiers: {
                    "btn-outline-dark": true,
                  }
                },
                title: "Edit tag set",
                action: "editTagSet",
              });
            newD.manage.push(
              {
                icon: "trash",
                options: {
                  iconOnly: true,
                  specifiers: {
                    "btn-outline-dark": true,
                  }
                },
                title: "Delete tag set",
                action: "deleteTagSet",
              });
          }
          if (!newD.public && (newD['userId'] === this.userId || this.isAdmin)) {
            newD.manage.push(
              {
                icon: "share",
                options: {
                  iconOnly: true,
                  specifiers: {
                    "btn-outline-dark": true,
                  }
                },
                title: "Share tag set",
                action: "publishTagSet",
              },
            );
          }

          return newD;
        }
      );
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
          this.$refs.tagSetDeleteModal.open(data.params.id);
          break;
        case "publishTagSet":
          this.$refs.tagSetPublishModal.open(data.params.id);
          break;
        case "defaultTagSet":
          this.selectAsDefault(data.params.id);
          break;
      }
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