<template>
  <div class="card">
    <div class="card-header d-flex justify-content-between align-items-center">
      Tag Sets
      <button
        class="btn btn-primary btn-sm"
        @click="$refs.tagSetModal.new()"
      >
        Add new tag set
      </button>
    </div>

    <div class="card-body p-2">
      <Loader
        v-if="tagSets === null || tags === null"
        :loading="tagSets === null"
        text="Collecting data..."
      />

      <span v-else-if="tagSets.length === 0">
        No tag sets are available...
      </span>
      <table
        v-else
        ref="tagsTable"
        class="table table-hover"
      >
        <thead>
          <tr>
            <th scope="col" />
            <th scope="col">
              Name
            </th>
            <th scope="col">
              Created
            </th>
            <th scope="col">
              Last change
            </th>
            <th scope="col">
              Public
            </th>
            <th scope="col">
              User
            </th>
            <th scope="col">
              #Tags
            </th>
            <th scope="col">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="tagSet in tagSets"
            :key="tagSet.id"
          >
            <td>
              <LoadIcon
                v-if="tagSet.id === selectedTagset"
                :size="16"
                icon-name="star-fill"
                style="color:yellowgreen;"
              />

              <LoadIcon
                v-else
                v-tooltip
                :size="16"
                icon-name="star"
                role="button"
                title="Select tagset as default"
                @click="selectAsDefault(tagSet.id)"
              />
            </td>
            <td>{{ tagSet['name'] }}</td>
            <td>{{ new Date(tagSet['createdAt']).toLocaleString("en-US") }}</td>
            <td>{{ new Date(tagSet['updatedAt']).toLocaleString("en-US") }}</td>
            <td>
              <div
                v-if="tagSet['public'] || tagSet['userId'] === null"
                class="badge bg-success"
              >
                Yes
              </div>
              <div
                v-else
                class="badge bg-danger"
              >
                No
              </div>
            </td>
            <td>
              <div class="badge bg-black">
                {{ tagSet['creator_name'] }}
              </div>
            </td>
            <td>
              <div
                v-tooltip
                :title="tags.filter(tag => tag.tagSetId === tagSet.id).map(e => e.name).join('<br>')"
                class="badge bg-primary"
                data-bs-html="true"
                data-bs-placement="top"
                data-bs-toggle="tooltip"
                role="button"
              >
                {{ tags.filter(tag => tag.tagSetId === tagSet.id).length }}
              </div>
            </td>
            <td>
              <div
                aria-label="Basic example"
                class="btn-group  btn-group-sm"
                role="group"
              >
                <button
                  v-if="tagSet['userId'] === userId || isAdmin"
                  v-tooltip
                  class="btn btn-outline-dark btn-sm"
                  title="Edit"
                  @click="$refs.tagSetModal.edit(tagSet.id)"
                >
                  <svg
                    class="bi bi-pencil"
                    fill="currentColor"
                    height="12"
                    viewBox="0 0 16 16"
                    width="12"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"
                    />
                  </svg>
                </button>
                <button
                  v-if="tagSet.userId === userId || isAdmin"
                  v-tooltip
                  class="btn btn-outline-dark btn-sm"
                  title="Delete"
                  @click="$refs.tagSetDeleteModal.open(tagSet.id)"
                >
                  <svg
                    class="bi bi-trash"
                    fill="currentColor"
                    height="12"
                    viewBox="0 0 16 16"
                    width="12"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"
                    />
                    <path
                      d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"
                      fill-rule="evenodd"
                    />
                  </svg>
                </button>
                <button
                  v-tooltip
                  class="btn btn-outline-dark btn-sm"
                  title="Copy"
                  @click="$refs.tagSetModal.copy(tagSet.id)"
                >
                  <svg
                    class="bi bi-clipboard"
                    fill="currentColor"
                    height="16"
                    viewBox="0 0 16 16"
                    width="16"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"
                    />
                    <path
                      d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"
                    />
                  </svg>
                </button>
                <button
                  v-if="!tagSet.public && (tagSet.userId === userId || isAdmin)"
                  v-tooltip
                  class="btn btn-outline-dark btn-sm"
                  title="Share"
                  @click="$refs.tagSetPublishModal.open(tagSet.id)"
                >
                  <svg
                    class="bi bi-share"
                    fill="currentColor"
                    height="12"
                    viewBox="0 0 16 16"
                    width="12"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M13.5 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM11 2.5a2.5 2.5 0 1 1 .603 1.628l-6.718 3.12a2.499 2.499 0 0 1 0 1.504l6.718 3.12a2.5 2.5 0 1 1-.488.876l-6.718-3.12a2.5 2.5 0 1 1 0-3.256l6.718-3.12A2.5 2.5 0 0 1 11 2.5zm-8.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm11 5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"
                    />
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <TagSetModal
    id="0"
    ref="tagSetModal"
  />
  <TagSetDeleteModal ref="tagSetDeleteModal" />
  <TagSetPublishModal ref="tagSetPublishModal" />
</template>

<script>
import {mapGetters} from "vuex";
import Loader from "@/basic/Loader.vue";
import TagSetModal from "./tags/TagSetModal.vue";
import TagSetPublishModal from "./tags/TagSetPublishModal.vue";
import TagSetDeleteModal from "./tags/TagSetDeleteModal.vue";
import {tooltip} from "@/assets/tooltip.js";
import LoadIcon from "@/icons/LoadIcon.vue";

/* Tags.vue - dashboard component for handling tags

This dashboard component provides a view to update/edit and add tags

Author: Dennis Zyska (zyska@ukp...)
Source: -
*/
export default {
  name: "Tags",
  components: {LoadIcon, TagSetModal, Loader, TagSetPublishModal, TagSetDeleteModal},
  directives: {
    tooltip
  },
  props: {
    'admin': {
      required: false,
      default: false
    },
  },
  data() {
    return {
      fields: [
        {name: "Name", col: "name"},
        {name: "Created At", col: "createdAt"}
      ],
    }
  },
  mounted() {
    this.$socket.emit("tagSetGetAll");
    this.$socket.emit("tagGetAll");
  },
  methods: {
    selectAsDefault(tagSetId) {
      this.$socket.emit("settingSet", {key: "tags.tagSet.default", value: tagSetId});
    },
  },
  computed: {
    ...mapGetters({
      tagSets: 'tag/getTagSets',
      userId: 'auth/getUserId',
      isAdmin: 'auth/isAdmin',
    }),
    tags() {
      return this.$store.getters["tag/getAllTags"]();
    },
    selectedTagset() {
      return this.$store.getters['settings/getValueAsInt']("tags.tagSet.default");
    },
  },
}
</script>

<style scoped>

</style>