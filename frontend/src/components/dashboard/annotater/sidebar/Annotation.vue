<template>
<b-card>
  <div class="card-header">
    <a id="user_info">User: {{ annoData.user }}</a>
  </div>
  <div class="card-body">
    <div v-if="annoData.anchors != null">
      <h6 class="card-subtitle mb-2 text-muted" v-for="anchor in annoData.anchors">
        {{ anchor }}
      </h6>
    </div>
    <p v-if="annoData.comment.length > 0" class="card-text">
      {{ annoData.comment }}
    </p>
    <p v-else class="card-text"> - </p>
  </div>
  <div class="card-body">
    <a class="btn btn-primary">Delete</a>
    <a class="btn btn-primary">Edit</a>
  </div>
  <div class="card-body">

  </div>
</b-card>
</template>

<script>
export default {
  name: "Annotation",
  props: ["annoData"],
  data: function() {
    return {
    }
  },
  computed: {
  },
  methods: {
  }
}
</script>

<style scoped>
.card-header {
  text-align: right;
  font-size: smaller;
  color: #929292;
}
</style>