<template>
<b-card>
  <div class="card-header">
    {{ annoData.user }}
  </div>
  <div class="card-body">
    <!--<h6 class="card-subtitle mb-2 text-muted" v-for="anchor in annoData.anchors">
        {{ anchor }}
    </h6>-->
    <p v-if="annoData.comment.length > 0" class="card-text">{{ annoData.comment }}</p>
    <p v-else class="card-text"> - </p>
  <div class="card-body">
    <a href="#" class="btn btn-primary">Delete</a>
  </div>
  <div class="card-body">
    <p> tags </p>
  </div>
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

</style>