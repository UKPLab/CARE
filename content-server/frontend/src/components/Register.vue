<template>
  <div class="col-md-8">
    <div class="card">
      <div class="card-header">Register</div>
      <div class="card-body">
        <div class="form-group row">
          <label for="first_name" class="col-md-4 col-form-label text-md-right">First name</label>
          <div class="col-md-6">
            <input type="text" id="first_name" class="form-control" name="first_name" required autofocus>
          </div>
        </div>

        <div class="form-group row">
          <div class="col-md-6 offset-md-4">
            <label>
              <input type="checkbox" name="terms"> I accept the terms!
            </label>
          </div>
        </div>

        <div class="col-md-6 offset-md-4">
          <button type="button" class="btn btn-primary">Register</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "Register"
}
</script>

<style scoped>

</style>